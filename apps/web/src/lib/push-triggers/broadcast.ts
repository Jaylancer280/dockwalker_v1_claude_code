import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushNotification } from '../push-delivery';
import { sendPushToUser } from '../push-delivery';
import { sendWhatsApp } from '../whatsapp';
import { getJobNumber } from './loaders';
import { currencySymbol } from '@dockwalker/shared';

const BROADCAST_WINDOW_MS = 60_000;

interface BroadcastEntry {
  timer: ReturnType<typeof setTimeout>;
  dayworkIds: string[];
  sc: SupabaseClient;
  posterPersonId: string;
}

// Exported for testing
export const broadcastQueue = new Map<string, BroadcastEntry>();

export function enqueueBroadcast(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  posterPersonId: string,
): void {
  const dayworkId = payload.id as string;
  const portId = payload.location_port_id as string;

  // Resolve port -> city, then enqueue
  resolveCityForPort(sc, portId)
    .then((cityId) => {
      if (!cityId) return;

      const existing = broadcastQueue.get(cityId);
      if (existing) {
        existing.dayworkIds.push(dayworkId);
        return;
      }

      const entry: BroadcastEntry = {
        timer: setTimeout(() => {
          broadcastQueue.delete(cityId);
          fireBroadcast(entry.sc, cityId, entry.dayworkIds, entry.posterPersonId).catch(() => {});
        }, BROADCAST_WINDOW_MS),
        dayworkIds: [dayworkId],
        sc,
        posterPersonId,
      };
      broadcastQueue.set(cityId, entry);
    })
    .catch(() => {});
}

export async function resolveCityForPort(
  sc: SupabaseClient,
  portId: string,
): Promise<string | null> {
  const { data } = await sc.from('ports').select('city_id').eq('id', portId).single();
  return data?.city_id ?? null;
}

export async function fireBroadcast(
  sc: SupabaseClient,
  cityId: string,
  dayworkIds: string[],
  posterPersonId: string,
): Promise<void> {
  // Find crew with active availability in this city
  const { data: windows } = await sc
    .from('availability_windows')
    .select('person_id')
    .eq('city_id', cityId)
    .eq('not_available', false)
    .gt('expires_at', new Date().toISOString());

  if (!windows || windows.length === 0) return;

  // Deduplicate and exclude the poster
  const recipientIds = [...new Set(windows.map((w) => w.person_id as string))].filter(
    (id) => id !== posterPersonId,
  );

  if (recipientIds.length === 0) return;

  let notification: PushNotification;

  if (dayworkIds.length === 1) {
    // Single posting — include specific details
    const jobNumber = await getJobNumber(sc, dayworkIds[0]);
    const { data: dw } = await sc
      .from('dayworks')
      .select('role_id')
      .eq('id', dayworkIds[0])
      .single();
    let roleName = 'daywork';
    if (dw?.role_id) {
      const { data: role } = await sc
        .from('yacht_roles')
        .select('name')
        .eq('id', dw.role_id)
        .single();
      if (role?.name) roleName = role.name;
    }
    const { data: city } = await sc.from('cities').select('name').eq('id', cityId).single();
    const cityName = city?.name ?? 'your area';

    notification = {
      title: 'New Daywork',
      body: `New ${roleName} daywork in ${cityName} — ${jobNumber}`,
      data: { screen: 'discover', dayworkId: dayworkIds[0] },
    };
  } else {
    // Collapsed — multiple postings
    const { data: city } = await sc.from('cities').select('name').eq('id', cityId).single();
    const cityName = city?.name ?? 'your area';

    notification = {
      title: 'New Daywork',
      body: `${dayworkIds.length} new daywork opportunities in ${cityName}`,
      data: { screen: 'discover' },
    };
  }

  // Batch-query WhatsApp channels for all recipients
  const { data: waChannels } = await sc
    .from('notification_channels')
    .select('person_id, channel_value_encrypted')
    .in('person_id', recipientIds)
    .eq('channel_type', 'whatsapp')
    .eq('verified', true);

  // Also check whatsapp_enabled preference
  const { data: waPrefs } = await sc
    .from('user_preferences')
    .select('person_id, whatsapp_enabled')
    .in('person_id', recipientIds)
    .eq('whatsapp_enabled', true);

  const waEnabledSet = new Set((waPrefs ?? []).map((p) => p.person_id as string));
  const waChannelMap = new Map<string, Buffer>();
  for (const ch of waChannels ?? []) {
    if (waEnabledSet.has(ch.person_id as string)) {
      waChannelMap.set(ch.person_id as string, Buffer.from(ch.channel_value_encrypted));
    }
  }

  // Resolve WhatsApp template variables for dw_new_job
  let waVariables: string[] | null = null;
  if (waChannelMap.size > 0 && dayworkIds.length === 1) {
    const { data: dw } = await sc
      .from('dayworks')
      .select('day_rate, currency, start_date, role_id, yacht_roles:role_id(name)')
      .eq('id', dayworkIds[0])
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = dw as any;
    const { data: city } = await sc.from('cities').select('name').eq('id', cityId).single();
    const roleName = d?.yacht_roles?.name ?? 'daywork';
    const sym = d?.currency ? currencySymbol(d.currency) : '€';
    const startDate = d?.start_date
      ? new Date(d.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        })
      : 'TBC';
    waVariables = [
      roleName,
      city?.name ?? 'your area',
      await getJobNumber(sc, dayworkIds[0]),
      `${sym}${d?.day_rate ?? ''}`,
      startDate,
    ];
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

  for (const recipientId of recipientIds) {
    const waPhone = waChannelMap.get(recipientId);
    if (waPhone && waVariables) {
      // Send WhatsApp — don't send push for this recipient
      sendWhatsApp(waPhone, 'dw_new_job', waVariables, `${siteUrl}/discover`).catch(() => {});
    } else {
      // No WhatsApp — send push
      sendPushToUser(sc, recipientId, notification).catch(() => {});
    }
  }
}
