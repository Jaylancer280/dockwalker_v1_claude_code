import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push-delivery';
import { sendWhatsApp } from '@/lib/whatsapp';

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
    const { data: activeWindows } = await serviceClient
      .from('availability_windows')
      .select('person_id, date')
      .gt('expires_at', new Date().toISOString())
      .eq('not_available', false);

    const expiringPersonIds: string[] = [];
    if (activeWindows && activeWindows.length > 0) {
      const maxDateByPerson = new Map<string, string>();
      for (const w of activeWindows) {
        const pid = w.person_id as string;
        const d = w.date as string;
        const current = maxDateByPerson.get(pid);
        if (!current || d > current) maxDateByPerson.set(pid, d);
      }
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      for (const [personId, maxDate] of maxDateByPerson) {
        if (maxDate === tomorrowStr) expiringPersonIds.push(personId);
      }
    }

    // ── Trigger 2: Stale availability (7 days no update) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stalePersonIds: string[] = [];
    const { data: staleCrew } = await serviceClient
      .from('availability_windows')
      .select('person_id, created_at, not_available, expires_at')
      .order('created_at', { ascending: false });

    if (staleCrew) {
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
        if (info.hasActive || info.hasNotAvailable) continue;
        if (info.lastCreated > sevenDaysAgo) continue;
        stalePersonIds.push(personId);
      }
    }

    // Batch-query WhatsApp channels for all recipients
    const allRecipientIds = [...new Set([...expiringPersonIds, ...stalePersonIds])];
    const waChannelMap = await batchGetWhatsAppChannels(serviceClient, allRecipientIds);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

    // Notify expiring crew
    for (const personId of expiringPersonIds) {
      const sent = await notifyExpiringIfNeeded(
        serviceClient,
        personId,
        waChannelMap.get(personId) ?? null,
        siteUrl,
      );
      if (sent) notifiedExpiring++;
    }

    // Notify stale crew
    for (const personId of stalePersonIds) {
      const sent = await notifyStaleIfNeeded(
        serviceClient,
        personId,
        waChannelMap.get(personId) ?? null,
        siteUrl,
      );
      if (sent) notifiedStale++;
    }

    return NextResponse.json({ notifiedExpiring, notifiedStale });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function batchGetWhatsAppChannels(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  personIds: string[],
): Promise<Map<string, Buffer>> {
  if (personIds.length === 0) return new Map();
  const { data: channels } = await serviceClient
    .from('notification_channels')
    .select('person_id, channel_value_encrypted')
    .in('person_id', personIds)
    .eq('channel_type', 'whatsapp')
    .eq('verified', true);
  const { data: prefs } = await serviceClient
    .from('user_preferences')
    .select('person_id, whatsapp_enabled')
    .in('person_id', personIds)
    .eq('whatsapp_enabled', true);
  const enabledSet = new Set((prefs ?? []).map((p) => p.person_id as string));
  const map = new Map<string, Buffer>();
  for (const ch of channels ?? []) {
    if (enabledSet.has(ch.person_id as string)) {
      map.set(ch.person_id as string, Buffer.from(ch.channel_value_encrypted));
    }
  }
  return map;
}

async function notifyExpiringIfNeeded(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  personId: string,
  waPhone: Buffer | null,
  siteUrl: string,
): Promise<boolean> {
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

  // WhatsApp first — static template, no variables
  if (waPhone) {
    const sent = await sendWhatsApp(
      waPhone,
      'reminder_availability_expiring',
      [],
      `${siteUrl}/profile`,
    );
    if (sent) return true;
  }

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
  waPhone: Buffer | null,
  siteUrl: string,
): Promise<boolean> {
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

  // WhatsApp first — static template, no variables
  if (waPhone) {
    const sent = await sendWhatsApp(
      waPhone,
      'reminder_availability_stale',
      [],
      `${siteUrl}/profile`,
    );
    if (sent) return true;
  }

  sendPushToUser(serviceClient, personId, {
    title: 'Update Your Availability',
    body: "It's been a while — set your availability to see daywork in your area.",
    data: { screen: 'discover' },
  }).catch(() => {});

  return true;
}
