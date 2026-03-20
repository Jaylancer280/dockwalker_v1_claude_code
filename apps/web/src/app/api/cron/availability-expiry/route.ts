import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push-delivery';

/**
 * GET /api/cron/availability-expiry
 * Vercel Cron — runs daily at 08:00 UTC.
 * Notifies crew whose availability expires within 24 hours.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  try {
    // Find crew with availability expiring in the next 24 hours
    const now = new Date().toISOString();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: expiringWindows, error: expError } = await serviceClient
      .from('availability_windows')
      .select('person_id')
      .gt('expires_at', now)
      .lte('expires_at', in24h)
      .eq('not_available', false);

    if (expError) {
      return NextResponse.json({ error: expError.message }, { status: 500 });
    }

    if (!expiringWindows || expiringWindows.length === 0) {
      return NextResponse.json({ notified: 0 });
    }

    // Deduplicate by person_id
    const personIds = [...new Set(expiringWindows.map((w) => w.person_id as string))];

    let notified = 0;

    for (const personId of personIds) {
      // Check if already notified in last 24 hours
      const { data: existing } = await serviceClient
        .from('notifications')
        .select('id')
        .eq('person_id', personId)
        .eq('type', 'availability_expiring')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create in-app notification
      await serviceClient.from('notifications').insert({
        person_id: personId,
        type: 'availability_expiring',
        title: 'Your availability expires soon',
        body: 'Your availability window expires in less than 24 hours. Update it to stay visible to employers.',
        deep_link: '/discover',
        role_context: 'crew',
      });

      // Send push notification (fire-and-forget)
      sendPushToUser(serviceClient, personId, {
        title: 'Availability Expiring',
        body: 'Your availability expires in less than 24 hours — update it to stay visible.',
        data: { screen: 'discover' },
      }).catch(() => {});

      notified++;
    }

    return NextResponse.json({ notified });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
