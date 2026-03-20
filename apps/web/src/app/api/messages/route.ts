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
        id, crew_person_id, employer_person_id, daywork_id, start_date, end_date, status,
        crew_completion_status,
        dayworks(yacht_roles(name), ports(name)),
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
        id, crew_person_id, employer_person_id, daywork_id, start_date, end_date, status,
        crew_completion_status,
        dayworks(yacht_roles(name), ports(name)),
        profiles!active_engagements_crew_person_id_profiles_fkey(display_name, avatar_url)
      `,
        )
        .eq('employer_person_id', user.id);

      if (employerError) {
        return NextResponse.json({ error: employerError.message }, { status: 500 });
      }

      allEngagements = (asEmployer ?? []).map((e) => ({ ...e, role: 'employer' as const }));
    }

    // Check which completed/cancelled engagements the user has already rated
    const ratableIds = allEngagements
      .filter((e) => e.status === 'completed' || e.status === 'cancelled')
      .map((e) => e.id);

    let ratedEngagementIds = new Set<string>();
    if (ratableIds.length > 0) {
      const { data: ratings } = await supabase
        .from('engagement_ratings')
        .select('engagement_id')
        .eq('rater_person_id', user.id)
        .in('engagement_id', ratableIds);

      ratedEngagementIds = new Set((ratings ?? []).map((r) => r.engagement_id));
    }

    // Get last message for each engagement
    const engagementIds = allEngagements.map((e) => e.id);
    const lastMessages: Record<
      string,
      { content: string; created_at: string; sender_person_id: string }
    > = {};
    const unreadCounts: Record<string, number> = {};

    if (engagementIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('engagement_id, content, created_at, sender_person_id')
        .in('engagement_id', engagementIds)
        .order('created_at', { ascending: false });

      for (const msg of messages ?? []) {
        if (!lastMessages[msg.engagement_id]) {
          lastMessages[msg.engagement_id] = {
            content: msg.content,
            created_at: msg.created_at,
            sender_person_id: msg.sender_person_id,
          };
        }
      }

      // Single RPC replaces N per-engagement COUNT queries + cursor lookup
      const { data: unreadRows } = await supabase.rpc('get_unread_counts', {
        p_person_id: user.id,
      });
      for (const r of unreadRows ?? []) {
        unreadCounts[r.engagement_id as string] = r.unread_count as number;
      }
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

      // Overdue: active engagement past end_date + 3 day grace
      const endMs = endDate ? new Date(endDate + 'T23:59:59Z').getTime() : 0;
      const isOverdue =
        eng.status === 'active' && endDate < todayStr && nowMs - endMs > OVERDUE_GRACE_MS;

      // Strip person_ids from response — not needed by frontend, prevents identity leaks
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { crew_person_id: _c, employer_person_id: _e, ...rest } = eng;

      return {
        ...rest,
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
    return NextResponse.json({ conversations, unread_total: unreadTotal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
