import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push-delivery';
import { getRecipientEmail } from '@/lib/push-triggers';
import { sendEmail } from '@/lib/email/send';
import { engagementStartingEmail } from '@/lib/email/templates';

/**
 * GET /api/cron/engagement-starts
 * Daily cron (07:00 UTC) — notifies both parties 24h before an engagement starts.
 * Sends in-app notification, push, and email. Duplicate prevention within 24h.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const serviceClient = await createServiceClient();

    // Find engagements starting tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: engagements } = await serviceClient
      .from('active_engagements')
      .select('id, crew_person_id, employer_person_id, start_date, daywork_id')
      .eq('status', 'active')
      .eq('start_date', tomorrow);

    if (!engagements || engagements.length === 0) {
      return NextResponse.json({ notified: 0 });
    }

    // Batch-fetch names for all involved persons
    const personIds = [
      ...new Set(engagements.flatMap((e) => [e.crew_person_id, e.employer_person_id])),
    ];
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('person_id, display_name')
      .in('person_id', personIds);
    const nameMap = new Map(
      (profiles ?? []).map((p: { person_id: string; display_name: string }) => [
        p.person_id,
        p.display_name,
      ]),
    );

    // Batch-fetch role names for all dayworks
    const dayworkIds = [...new Set(engagements.map((e) => e.daywork_id))];
    const { data: dayworks } = await serviceClient
      .from('dayworks')
      .select('id, yacht_roles(name)')
      .in('id', dayworkIds);
    const roleMap = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dayworks ?? []).map((d: any) => [
        d.id as string,
        (d.yacht_roles?.name ?? 'Daywork') as string,
      ]),
    );

    let notified = 0;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const eng of engagements) {
      const parties = [
        { personId: eng.crew_person_id, roleContext: 'crew' as const },
        { personId: eng.employer_person_id, roleContext: 'employer' as const },
      ];

      for (const { personId, roleContext } of parties) {
        // Duplicate prevention — skip if already notified in last 24h
        const { data: existing } = await serviceClient
          .from('notifications')
          .select('id')
          .eq('person_id', personId)
          .eq('type', 'engagement_starting')
          .gt('created_at', cutoff)
          .like('deep_link', `%${eng.id}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const recipientName = nameMap.get(personId) ?? 'there';
        const otherPersonId =
          personId === eng.crew_person_id ? eng.employer_person_id : eng.crew_person_id;
        const otherName = nameMap.get(otherPersonId) ?? 'your counterparty';
        const roleName = roleMap.get(eng.daywork_id) ?? 'Daywork';

        // In-app notification
        await serviceClient.from('notifications').insert({
          person_id: personId,
          type: 'engagement_starting',
          title: 'Engagement starts tomorrow',
          body: 'Your engagement starts tomorrow — check the pre-arrival checklist.',
          deep_link: `/messages/${eng.id}`,
          role_context: roleContext,
        });

        // Push
        sendPushToUser(serviceClient, personId, {
          title: 'Engagement Starts Tomorrow',
          body: 'Your engagement starts tomorrow — check the pre-arrival checklist.',
          data: { screen: 'chat', engagementId: eng.id },
        }).catch(() => {});

        // Email
        const email = await getRecipientEmail(serviceClient, personId);
        if (email) {
          const { subject, html } = engagementStartingEmail({
            recipientName,
            otherPartyName: otherName,
            roleName,
            startDate: eng.start_date,
            engagementId: eng.id,
          });
          sendEmail({ to: email, subject, html }).catch(() => {});
        }

        notified++;
      }
    }

    return NextResponse.json({ notified });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
