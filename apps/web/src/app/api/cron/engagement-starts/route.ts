import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push-delivery';
import { sendWhatsApp } from '@/lib/whatsapp';
import { getRecipientEmail } from '@/lib/push-triggers';
import { hasPushTokens } from '@/lib/push-triggers/loaders';
import { sendEmail } from '@/lib/email/send';
import { engagementStartingEmail, formatEmailDate } from '@/lib/email/templates';

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

    const { data: engagements, error: engError } = await serviceClient
      .from('active_engagements')
      .select(
        'id, crew_person_id, employer_person_id, start_date, daywork_id, permanent_posting_id',
      )
      .eq('status', 'active')
      .eq('start_date', tomorrow);

    if (engError) {
      return NextResponse.json({ error: engError.message }, { status: 500 });
    }

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

    // Batch-fetch role names + vessel context for all dayworks
    const dayworkIds = [
      ...new Set(engagements.filter((e) => e.daywork_id).map((e) => e.daywork_id)),
    ];
    const { data: dayworks } =
      dayworkIds.length > 0
        ? await serviceClient
            .from('dayworks')
            .select('id, yacht_roles(name), vessels(name, vessel_type)')
            .in('id', dayworkIds)
        : { data: [] };
    const roleMap = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dayworks ?? []).map((d: any) => [
        d.id as string,
        (d.yacht_roles?.name ?? 'Daywork') as string,
      ]),
    );
    const vesselLabelMap = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dayworks ?? []).map((d: any) => [
        d.id as string,
        d.vessels?.name
          ? `${d.vessels.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} ${d.vessels.name}`
          : '',
      ]),
    );

    // Batch-fetch role names + vessel context for permanent postings
    const permanentIds = [
      ...new Set(
        engagements.filter((e) => e.permanent_posting_id).map((e) => e.permanent_posting_id),
      ),
    ];
    let permanentRoleMap = new Map<string, string>();
    const permanentVesselLabelMap = new Map<string, string>();
    if (permanentIds.length > 0) {
      const { data: permanentPostings } = await serviceClient
        .from('permanent_postings')
        .select('id, yacht_roles(name), vessels(name, vessel_type)')
        .in('id', permanentIds);
      permanentRoleMap = new Map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (permanentPostings ?? []).map((p: any) => [
          p.id as string,
          (p.yacht_roles?.name ?? 'Permanent role') as string,
        ]),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (permanentPostings ?? []) as any[]) {
        if (p.vessels?.name) {
          permanentVesselLabelMap.set(
            p.id as string,
            `${p.vessels.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} ${p.vessels.name}`,
          );
        }
      }
    }

    // Batch-query WhatsApp channels for all involved persons
    const { data: waChannels } = await serviceClient
      .from('notification_channels')
      .select('person_id, channel_value_encrypted')
      .in('person_id', personIds)
      .eq('channel_type', 'whatsapp')
      .eq('verified', true);
    const { data: waPrefs } = await serviceClient
      .from('user_preferences')
      .select('person_id, whatsapp_enabled')
      .in('person_id', personIds)
      .eq('whatsapp_enabled', true);
    const waEnabledSet = new Set((waPrefs ?? []).map((p) => p.person_id as string));
    const waChannelMap = new Map<string, Buffer>();
    for (const ch of waChannels ?? []) {
      if (waEnabledSet.has(ch.person_id as string)) {
        waChannelMap.set(ch.person_id as string, Buffer.from(ch.channel_value_encrypted));
      }
    }

    let notified = 0;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

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
        const roleName = eng.daywork_id
          ? (roleMap.get(eng.daywork_id) ?? 'Daywork')
          : (permanentRoleMap.get(eng.permanent_posting_id) ?? 'Permanent role');
        const vesselLabel = eng.daywork_id
          ? (vesselLabelMap.get(eng.daywork_id) ?? null)
          : (permanentVesselLabelMap.get(eng.permanent_posting_id) ?? null);

        // In-app notification
        await serviceClient.from('notifications').insert({
          person_id: personId,
          type: 'engagement_starting',
          title: 'Engagement starts tomorrow',
          body: 'Your engagement starts tomorrow — check the pre-arrival checklist.',
          deep_link: `/messages/${eng.id}`,
          role_context: roleContext,
        });

        // WhatsApp — try first, skip push + email if successful
        const waPhone = waChannelMap.get(personId);
        let waSent = false;
        if (waPhone) {
          waSent = await sendWhatsApp(
            waPhone,
            'reminder_engagement_starts',
            [roleName, eng.daywork_id ? `DW-${String(eng.daywork_id).slice(0, 5)}` : 'your role'],
            `${siteUrl}/messages/${eng.id}`,
          );
        }

        if (!waSent) {
          // Push
          sendPushToUser(serviceClient, personId, {
            title: 'Engagement Starts Tomorrow',
            body: 'Your engagement starts tomorrow — check the pre-arrival checklist.',
            data: { screen: 'chat', engagementId: eng.id },
          }).catch(() => {});
        }

        // Email — only if no WhatsApp AND no push tokens and email is enabled
        const hasTokens = waSent || (await hasPushTokens(serviceClient, personId));
        if (!hasTokens) {
          const { data: prefs } = await serviceClient
            .from('user_preferences')
            .select('email_enabled')
            .eq('person_id', personId)
            .single();
          const emailEnabled = !prefs || prefs.email_enabled !== false;
          if (emailEnabled) {
            const email = await getRecipientEmail(serviceClient, personId);
            if (email) {
              const { subject, html } = engagementStartingEmail({
                recipientName,
                otherPartyName: otherName,
                roleName,
                vesselLabel: vesselLabel || null,
                startDateFormatted: formatEmailDate(eng.start_date),
                engagementId: eng.id,
              });
              sendEmail({ to: email, subject, html }).catch(() => {});
            }
          }
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
