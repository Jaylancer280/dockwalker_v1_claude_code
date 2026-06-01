-- =============================================================================
-- Rollback 00141: restore the original p_person_id-based get_unread_counts
-- and its default PUBLIC EXECUTE grant.
--
-- WARNING: this reintroduces audit finding S5 (the function will once again
-- trust the caller-supplied p_person_id and be callable by any role). Only roll
-- back if the forward migration caused a problem.
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

-- Restore the original default-PUBLIC grant state.
revoke execute on function public.get_unread_counts(uuid) from authenticated;
revoke execute on function public.get_unread_counts(uuid) from service_role;
grant execute on function public.get_unread_counts(uuid) to public;
