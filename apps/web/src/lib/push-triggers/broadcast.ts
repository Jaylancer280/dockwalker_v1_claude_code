import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushNotification } from '../push-delivery';
import { sendPushToUser } from '../push-delivery';
import { sendWhatsApp } from '../whatsapp';
import { sendTelegramMessage } from '../telegram';
import { decryptPhone, bufferFromBytea } from '../crypto';
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

function formatDayMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBC';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatJobNumber(jobNumber: number | null | undefined): string {
  return jobNumber ? `DW-${String(jobNumber).padStart(5, '0')}` : 'a daywork';
}

interface DayworkContext {
  jobNumber: string;
  roleName: string;
  daySym: string;
  dayRate: string;
  startDate: string;
  endDate: string;
}

export async function fireBroadcast(
  sc: SupabaseClient,
  cityId: string,
  dayworkIds: string[],
  posterPersonId: string,
): Promise<void> {
  // 1. Find crew with active availability in this city
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

  // 2. Resolve city name + (single-posting only) daywork details — in parallel
  const isSingle = dayworkIds.length === 1;
  const [cityResult, dwResult, channelsResult, prefsResult] = await Promise.all([
    sc.from('cities').select('name').eq('id', cityId).single(),
    isSingle
      ? sc
          .from('dayworks')
          .select('day_rate, currency, start_date, end_date, job_number, yacht_roles:role_id(name)')
          .eq('id', dayworkIds[0])
          .single()
      : Promise.resolve({ data: null }),
    sc
      .from('notification_channels')
      .select('person_id, channel_type, channel_value_encrypted')
      .in('person_id', recipientIds)
      .in('channel_type', ['telegram', 'whatsapp'])
      .eq('verified', true),
    sc
      .from('user_preferences')
      .select('person_id, telegram_enabled, whatsapp_enabled')
      .in('person_id', recipientIds),
  ]);

  const cityName = (cityResult.data as { name?: string } | null)?.name ?? 'your area';

  // 3. Compute single-posting context once (used by push body, WA template, Telegram body)
  let dw: DayworkContext | null = null;
  if (isSingle) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = dwResult.data as any;
    dw = {
      jobNumber: formatJobNumber(d?.job_number),
      roleName: d?.yacht_roles?.name ?? 'daywork',
      daySym: d?.currency ? currencySymbol(d.currency) : '€',
      dayRate: d?.day_rate != null ? String(d.day_rate) : '',
      startDate: formatDayMonth(d?.start_date),
      endDate: formatDayMonth(d?.end_date),
    };
  }

  // 4. Build push notification (used as fallback if no Telegram/WhatsApp)
  const notification: PushNotification = isSingle
    ? {
        title: 'New Daywork',
        body: `New ${dw!.roleName} daywork in ${cityName} — ${dw!.jobNumber}`,
        data: { screen: 'discover', dayworkId: dayworkIds[0] },
      }
    : {
        title: 'New Daywork',
        body: `${dayworkIds.length} new daywork opportunities in ${cityName}`,
        data: { screen: 'discover' },
      };

  // 5. Build channel maps from the merged channels + prefs results
  const tgEnabled = new Set<string>();
  const waEnabled = new Set<string>();
  for (const p of (prefsResult.data ?? []) as Array<{
    person_id: string;
    telegram_enabled?: boolean;
    whatsapp_enabled?: boolean;
  }>) {
    if (p.telegram_enabled) tgEnabled.add(p.person_id);
    if (p.whatsapp_enabled) waEnabled.add(p.person_id);
  }

  const tgChatIdMap = new Map<string, string>();
  const waChannelMap = new Map<string, Buffer>();
  for (const ch of (channelsResult.data ?? []) as Array<{
    person_id: string;
    channel_type: string;
    channel_value_encrypted: unknown;
  }>) {
    if (ch.channel_type === 'telegram' && tgEnabled.has(ch.person_id)) {
      try {
        const chatId = decryptPhone(bufferFromBytea(ch.channel_value_encrypted));
        tgChatIdMap.set(ch.person_id, chatId);
      } catch {
        // Skip — decryption failed (key mismatch)
      }
    } else if (ch.channel_type === 'whatsapp' && waEnabled.has(ch.person_id)) {
      waChannelMap.set(ch.person_id, Buffer.from(ch.channel_value_encrypted as ArrayBuffer));
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

  // 6. Build per-channel message bodies once (reused across all recipients)
  const waVariables: string[] | null =
    waChannelMap.size > 0 && isSingle
      ? [dw!.roleName, cityName, dw!.jobNumber, `${dw!.daySym}${dw!.dayRate}`, dw!.startDate]
      : null;

  let tgText: string | null = null;
  if (tgChatIdMap.size > 0) {
    if (isSingle) {
      tgText =
        `⚓ <b>New daywork — ${dw!.roleName}</b>\n` +
        `${cityName} · ${dw!.startDate} – ${dw!.endDate}\n` +
        `${dw!.daySym}${dw!.dayRate || '—'}/day · Ref: ${dw!.jobNumber}\n\n` +
        `<a href="${siteUrl}/discover">Browse in DockWalker</a>`;
    } else {
      tgText =
        `⚓ <b>${dayworkIds.length} new daywork postings</b>\n` +
        `${cityName}\n\n` +
        `<a href="${siteUrl}/discover">Browse in DockWalker</a>`;
    }
  }

  // 7. Dispatch — Telegram preferred, then WhatsApp, then push
  for (const recipientId of recipientIds) {
    const tgChatId = tgChatIdMap.get(recipientId);
    if (tgChatId && tgText) {
      sendTelegramMessage(tgChatId, tgText).catch(() => {});
      continue;
    }

    const waPhone = waChannelMap.get(recipientId);
    if (waPhone && waVariables) {
      sendWhatsApp(waPhone, 'dw_new_job', waVariables, `${siteUrl}/discover`).catch(() => {});
    } else {
      sendPushToUser(sc, recipientId, notification).catch(() => {});
    }
  }
}
