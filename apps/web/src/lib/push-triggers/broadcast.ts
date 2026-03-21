import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushNotification } from '../push-delivery';
import { sendPushToUser } from '../push-delivery';
import { getJobNumber } from './loaders';

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

  for (const recipientId of recipientIds) {
    sendPushToUser(sc, recipientId, notification).catch(() => {});
  }
}
