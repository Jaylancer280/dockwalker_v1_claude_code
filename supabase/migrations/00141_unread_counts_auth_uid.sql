-- =============================================================================
-- Migration 00141: get_unread_counts — derive identity from auth.uid()
--
-- Audit 2026-06-01 S5. The SECURITY DEFINER function previously trusted the
-- caller-supplied p_person_id, and (defaulting to PUBLIC EXECUTE) was callable
-- directly via PostgREST. Any authenticated user could pass a victim's UUID and
-- enumerate that victim's per-engagement unread message counts (conversation
-- metadata).
--
-- Fix: derive identity from auth.uid() instead of p_person_id, and restrict
-- EXECUTE to the authenticated role. The p_person_id parameter is retained ONLY
-- for call-signature compatibility (all existing callers pass their own
-- user.id via the user-bound anon client, so auth.uid() == p_person_id for them
-- and results are unchanged) and is intentionally ignored.
--
-- auth.uid() resolves correctly inside a SECURITY DEFINER function because
-- PostgREST sets the request JWT GUC per-request independent of the execution
-- role — the same mechanism every RLS policy relies on.
-- =============================================================================

create or replace function public.get_unread_counts(p_person_id uuid)
returns table (engagement_id uuid, unread_count bigint)
language sql
stable
security definer
as $$
  select
    m.engagement_id,
    count(*) as unread_count
  from public.messages m
  left join public.message_read_cursors mrc
    on mrc.engagement_id = m.engagement_id
    and mrc.person_id = auth.uid()
  where m.engagement_id in (
    select id from public.active_engagements
    where crew_person_id = auth.uid() or employer_person_id = auth.uid()
  )
  and m.sender_person_id != auth.uid()
  and m.created_at > coalesce(mrc.last_read_at, '1970-01-01'::timestamptz)
  group by m.engagement_id
  having count(*) > 0;
$$;

-- Lock down EXECUTE: remove the default PUBLIC grant (which is what exposed the
-- RPC to a direct authenticated attack with an arbitrary id) and grant only to
-- the roles that legitimately call it. Callers run as `authenticated`; the
-- service role is granted defensively (no current caller uses it for this RPC).
revoke execute on function public.get_unread_counts(uuid) from public;
revoke execute on function public.get_unread_counts(uuid) from anon;
grant execute on function public.get_unread_counts(uuid) to authenticated;
grant execute on function public.get_unread_counts(uuid) to service_role;
