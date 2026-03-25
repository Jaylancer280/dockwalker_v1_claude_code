import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push-delivery';

/**
 * GET /api/cron/availability-expiry
 * Vercel Cron — runs daily at 08:00 UTC.
 *
 * Trigger 1: Notifies crew whose last available day is tomorrow (24h warning).
 * Trigger 2: Nudges crew with no availability whose last update was 7+ days ago.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  let notifiedExpiring = 0;
  let notifiedStale = 0;

  try {
    // ── Trigger 1: Last available day is tomorrow ──
    // Fetch all non-expired normal availability, aggregate per person in JS
    const { data: activeWindows } = await serviceClient
      .from('availability_windows')
      .select('person_id, date')
      .gt('expires_at', new Date().toISOString())
      .eq('not_available', false);

    if (activeWindows && activeWindows.length > 0) {
      // Find max(date) per person
      const maxDateByPerson = new Map<string, string>();
      for (const w of activeWindows) {
        const pid = w.person_id as string;
        const d = w.date as string;
        const current = maxDateByPerson.get(pid);
        if (!current || d > current) maxDateByPerson.set(pid, d);
      }

      // Tomorrow's date string (UTC)
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // Notify crew whose last available day is tomorrow
      for (const [personId, maxDate] of maxDateByPerson) {
        if (maxDate === tomorrowStr) {
          const sent = await notifyExpiringIfNeeded(serviceClient, personId);
          if (sent) notifiedExpiring++;
        }
      }
    }

    // ── Trigger 2: Stale availability (7 days no update) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find crew with no current availability whose last window was created 7+ days ago
    // Exclude crew with active not_available rows (they opted out intentionally)
    const { data: staleCrew } = await serviceClient
      .from('availability_windows')
      .select('person_id, created_at, not_available, expires_at')
      .order('created_at', { ascending: false });

    if (staleCrew) {
      // Group by person_id, find those with no active windows and last created > 7 days ago
      const personMap = new Map<
        string,
        { hasActive: boolean; hasNotAvailable: boolean; lastCreated: string }
      >();

      for (const w of staleCrew) {
        const pid = w.person_id as string;
        const existing = personMap.get(pid);
        const isActive = new Date(w.expires_at as string) > new Date();

        if (!existing) {
          personMap.set(pid, {
            hasActive: isActive && !(w.not_available as boolean),
            hasNotAvailable: isActive && (w.not_available as boolean),
            lastCreated: w.created_at as string,
          });
        } else {
          if (isActive && !(w.not_available as boolean)) existing.hasActive = true;
          if (isActive && (w.not_available as boolean)) existing.hasNotAvailable = true;
        }
      }

      for (const [personId, info] of personMap) {
        // Skip if they have active availability or are explicitly not-available
        if (info.hasActive || info.hasNotAvailable) continue;
        // Skip if last created less than 7 days ago
        if (info.lastCreated > sevenDaysAgo) continue;

        const sent = await notifyStaleIfNeeded(serviceClient, personId);
        if (sent) notifiedStale++;
      }
    }

    return NextResponse.json({ notifiedExpiring, notifiedStale });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function notifyExpiringIfNeeded(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  personId: string,
): Promise<boolean> {
  // Check if already notified in last 24 hours
  const { data: existing } = await serviceClient
    .from('notifications')
    .select('id')
    .eq('person_id', personId)
    .eq('type', 'availability_expiring')
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (existing && existing.length > 0) return false;

  await serviceClient.from('notifications').insert({
    person_id: personId,
    type: 'availability_expiring',
    title: 'Your availability expires tomorrow',
    body: 'Update your availability to keep finding daywork in your area.',
    deep_link: '/discover',
    role_context: 'crew',
  });

  sendPushToUser(serviceClient, personId, {
    title: 'Availability Expiring',
    body: 'Your availability expires tomorrow — update it to stay visible.',
    data: { screen: 'discover' },
  }).catch(() => {});

  return true;
}

async function notifyStaleIfNeeded(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  personId: string,
): Promise<boolean> {
  // Check if already notified in last 7 days
  const { data: existing } = await serviceClient
    .from('notifications')
    .select('id')
    .eq('person_id', personId)
    .eq('type', 'availability_stale')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (existing && existing.length > 0) return false;

  await serviceClient.from('notifications').insert({
    person_id: personId,
    type: 'availability_stale',
    title: "It's been a while",
    body: 'Set your availability to see daywork in your area.',
    deep_link: '/discover',
    role_context: 'crew',
  });

  sendPushToUser(serviceClient, personId, {
    title: 'Update Your Availability',
    body: "It's been a while — set your availability to see daywork in your area.",
    data: { screen: 'discover' },
  }).catch(() => {});

  return true;
}
