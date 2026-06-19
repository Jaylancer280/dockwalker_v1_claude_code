-- =============================================================================
-- Migration 00058: get_unread_counts Postgres function
--
-- Replaces per-engagement COUNT loops in /api/notifications/count and
-- /api/messages with a single aggregate query. Returns unread message counts
-- per engagement for a given person, respecting read cursors.
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
    and mrc.person_id = p_person_id
  where m.engagement_id in (
    select id from public.active_engagements
    where crew_person_id = p_person_id or employer_person_id = p_person_id
  )
  and m.sender_person_id != p_person_id
  and m.created_at > coalesce(mrc.last_read_at, '1970-01-01'::timestamptz)
  group by m.engagement_id
  having count(*) > 0;
$$;
