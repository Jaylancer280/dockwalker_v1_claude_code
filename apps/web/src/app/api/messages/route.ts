import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/messages
 * Returns all engagements for the authenticated user (active, completed, cancelled)
 * with last message preview and rating status, for the conversations list.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    // Filter engagements by current hat: crew hat sees crew engagements, employer/agent hat sees employer engagements
    const isCrew = person.current_hat === 'crew';

    interface EngagementRow {
      id: string;
      status: string;
      start_date: string;
      role: 'crew' | 'employer';
      [key: string]: unknown;
    }
    let allEngagements: EngagementRow[];

    if (isCrew) {
      const { data: asCrew, error: crewError } = await supabase
        .from('active_engagements')
        .select(
          `
        id, crew_person_id, employer_person_id, daywork_id, permanent_posting_id, start_date, end_date, status, phase,
        crew_completion_status, cancelled_by,
        dayworks(yacht_roles(name), ports(name)),
        permanent_postings(id, yacht_roles(name), ports(name), vessels(name)),
        profiles!active_engagements_employer_person_id_profiles_fkey(display_name, avatar_url)
      `,
        )
        .eq('crew_person_id', user.id);

      if (crewError) {
        return NextResponse.json({ error: crewError.message }, { status: 500 });
      }

      allEngagements = (asCrew ?? []).map((e) => ({ ...e, role: 'crew' as const }));
    } else {
      const { data: asEmployer, error: employerError } = await supabase
        .from('active_engagements')
        .select(
          `
        id, crew_person_id, employer_person_id, daywork_id, permanent_posting_id, start_date, end_date, status, phase,
        crew_completion_status, cancelled_by,
        dayworks(yacht_roles(name), ports(name)),
        permanent_postings(id, yacht_roles(name), ports(name), vessels(name)),
        profiles!active_engagements_crew_person_id_profiles_fkey(display_name, avatar_url)
      `,
        )
        .eq('employer_person_id', user.id);

      if (employerError) {
        return NextResponse.json({ error: employerError.message }, { status: 500 });
      }

      allEngagements = (asEmployer ?? []).map((e) => ({ ...e, role: 'employer' as const }));
    }

    // Tier 2: ratings + messages + unread counts in parallel (all depend on engagements)
    const engagementIds = allEngagements.map((e) => e.id);
    const ratableIds = allEngagements
      .filter((e) => e.status === 'completed' || e.status === 'cancelled')
      .map((e) => e.id);

    const [ratingsResult, messagesResult, unreadResult] = await Promise.all([
      ratableIds.length > 0
        ? supabase
            .from('engagement_ratings')
            .select('engagement_id')
            .eq('rater_person_id', user.id)
            .in('engagement_id', ratableIds)
        : Promise.resolve({ data: null }),
      engagementIds.length > 0
        ? supabase
            .from('messages')
            .select('engagement_id, content, created_at, sender_person_id')
            .in('engagement_id', engagementIds)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: null }),
      engagementIds.length > 0
        ? supabase.rpc('get_unread_counts', { p_person_id: user.id })
        : Promise.resolve({ data: null }),
    ]);

    const ratedEngagementIds = new Set(
      (ratingsResult.data ?? []).map((r: { engagement_id: string }) => r.engagement_id),
    );

    const lastMessages: Record<
      string,
      { content: string; created_at: string; sender_person_id: string }
    > = {};
    for (const msg of messagesResult.data ?? []) {
      if (!lastMessages[msg.engagement_id]) {
        lastMessages[msg.engagement_id] = {
          content: msg.content,
          created_at: msg.created_at,
          sender_person_id: msg.sender_person_id,
        };
      }
    }

    const unreadCounts: Record<string, number> = {};
    for (const r of unreadResult.data ?? []) {
      unreadCounts[r.engagement_id as string] = r.unread_count as number;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();
    const RATING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
    const OVERDUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

    const conversations = allEngagements.map((eng) => {
      // Rating timeout: 14 days after the engagement's end_date
      let ratingExpiresAt: string | null = null;
      let ratingExpired = false;
      const endDate = eng.end_date as string;
      if (eng.status === 'completed' && endDate) {
        const endMs = new Date(endDate + 'T23:59:59Z').getTime();
        const expiresAt = endMs + RATING_WINDOW_MS;
        ratingExpiresAt = new Date(expiresAt).toISOString();
        ratingExpired = nowMs > expiresAt;
      }

      // Overdue: active engagement past end_date + 3 day grace (daywork only)
      const endMs = endDate ? new Date(endDate + 'T23:59:59Z').getTime() : 0;
      const isPermanent = !!(eng as Record<string, unknown>).permanent_posting_id;
      const isOverdue =
        !isPermanent &&
        eng.status === 'active' &&
        endDate &&
        endDate < todayStr &&
        nowMs - endMs > OVERDUE_GRACE_MS;

      // Strip person_ids from response — not needed by frontend, prevents identity leaks
      const { crew_person_id: _c, employer_person_id: _e, ...rest } = eng;

      return {
        ...rest,
        type: isPermanent ? 'permanent' : 'daywork',
        has_rated: ratedEngagementIds.has(eng.id),
        last_message: lastMessages[eng.id] ?? null,
        unread_count: unreadCounts[eng.id] ?? 0,
        rating_expires_at: ratingExpiresAt,
        rating_expired: ratingExpired,
        is_overdue: isOverdue,
      };
    });

    // Sort by last message time (most recent first), then by engagement creation
    conversations.sort((a, b) => {
      const aTime = a.last_message?.created_at ?? a.start_date;
      const bTime = b.last_message?.created_at ?? b.start_date;
      return bTime.localeCompare(aTime);
    });

    const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

    // Phase 4 — references consent pseudo-threads. Pending invitations the
    // caller is the referee on + pending reference-contact requests the
    // caller is the referee on. Each appears in /messages above active
    // conversations until accepted/declined.
    interface ConsentPrompt {
      kind: 'reference_invitation' | 'reference_contact';
      id: string;
      reference_id: string;
      created_at: string;
      requester_display_name: string | null;
      employer_display_name: string | null;
      snapshot_vessel_name: string;
      snapshot_vessel_imo: string;
      snapshot_start_date: string;
      snapshot_end_date: string | null;
      requester_role_at_time: string;
      claimed_referee_role: string;
      question: string | null;
      pending_expires_at: string | null;
    }
    const consentPrompts: ConsentPrompt[] = [];

    // (a) Reference invitations where caller is the auth'd referee.
    const { data: pendingInvitations } = await supabase
      .from('references')
      .select(
        `id, requester_person_id, snapshot_vessel_name, snapshot_vessel_imo,
         snapshot_start_date, snapshot_end_date, requester_role_at_time,
         claimed_referee_role, pending_expires_at, created_at,
         requester:profiles!references_requester_person_id_fkey(display_name)`,
      )
      .eq('referee_person_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    for (const r of (pendingInvitations ?? []) as Array<{
      id: string;
      requester_person_id: string;
      snapshot_vessel_name: string;
      snapshot_vessel_imo: string;
      snapshot_start_date: string;
      snapshot_end_date: string | null;
      requester_role_at_time: string;
      claimed_referee_role: string;
      pending_expires_at: string;
      created_at: string;
      requester: { display_name?: string | null } | null;
    }>) {
      consentPrompts.push({
        kind: 'reference_invitation',
        id: r.id,
        reference_id: r.id,
        created_at: r.created_at,
        requester_display_name: r.requester?.display_name ?? null,
        employer_display_name: null,
        snapshot_vessel_name: r.snapshot_vessel_name,
        snapshot_vessel_imo: r.snapshot_vessel_imo,
        snapshot_start_date: r.snapshot_start_date,
        snapshot_end_date: r.snapshot_end_date,
        requester_role_at_time: r.requester_role_at_time,
        claimed_referee_role: r.claimed_referee_role,
        question: null,
        pending_expires_at: r.pending_expires_at,
      });
    }

    // (b) Pending reference-contact requests where the auth'd user is the
    // referee on the underlying accepted reference. Two-step: first the refs,
    // then the contacts whose reference_id is in that set.
    const { data: myAcceptedRefs } = await supabase
      .from('references')
      .select(
        `id, requester_person_id, snapshot_vessel_name, snapshot_vessel_imo,
         snapshot_start_date, snapshot_end_date, requester_role_at_time,
         claimed_referee_role,
         requester:profiles!references_requester_person_id_fkey(display_name)`,
      )
      .eq('referee_person_id', user.id)
      .eq('status', 'accepted');
    const refMap = new Map<
      string,
      {
        requester_display_name: string | null;
        snapshot_vessel_name: string;
        snapshot_vessel_imo: string;
        snapshot_start_date: string;
        snapshot_end_date: string | null;
        requester_role_at_time: string;
        claimed_referee_role: string;
      }
    >();
    for (const r of (myAcceptedRefs ?? []) as Array<{
      id: string;
      snapshot_vessel_name: string;
      snapshot_vessel_imo: string;
      snapshot_start_date: string;
      snapshot_end_date: string | null;
      requester_role_at_time: string;
      claimed_referee_role: string;
      requester: { display_name?: string | null } | null;
    }>) {
      refMap.set(r.id, {
        requester_display_name: r.requester?.display_name ?? null,
        snapshot_vessel_name: r.snapshot_vessel_name,
        snapshot_vessel_imo: r.snapshot_vessel_imo,
        snapshot_start_date: r.snapshot_start_date,
        snapshot_end_date: r.snapshot_end_date,
        requester_role_at_time: r.requester_role_at_time,
        claimed_referee_role: r.claimed_referee_role,
      });
    }
    const acceptedRefIds = Array.from(refMap.keys());
    if (acceptedRefIds.length > 0) {
      const { data: pendingContacts } = await supabase
        .from('reference_contacts')
        .select(
          `id, reference_id, employer_person_id, question, created_at,
           employer:profiles!reference_contacts_employer_person_id_fkey(display_name)`,
        )
        .in('reference_id', acceptedRefIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      for (const c of (pendingContacts ?? []) as Array<{
        id: string;
        reference_id: string;
        employer_person_id: string;
        question: string | null;
        created_at: string;
        employer: { display_name?: string | null } | null;
      }>) {
        const refSummary = refMap.get(c.reference_id);
        if (!refSummary) continue;
        consentPrompts.push({
          kind: 'reference_contact',
          id: c.id,
          reference_id: c.reference_id,
          created_at: c.created_at,
          requester_display_name: refSummary.requester_display_name,
          employer_display_name: c.employer?.display_name ?? null,
          snapshot_vessel_name: refSummary.snapshot_vessel_name,
          snapshot_vessel_imo: refSummary.snapshot_vessel_imo,
          snapshot_start_date: refSummary.snapshot_start_date,
          snapshot_end_date: refSummary.snapshot_end_date,
          requester_role_at_time: refSummary.requester_role_at_time,
          claimed_referee_role: refSummary.claimed_referee_role,
          question: c.question,
          pending_expires_at: null,
        });
      }
    }

    // Sort consent prompts most-recent first.
    consentPrompts.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return NextResponse.json({
      conversations,
      unread_total: unreadTotal,
      consent_prompts: consentPrompts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
