-- =============================================================================
-- Migration 00110: grouped_notifications() RPC
--
-- Returns the current user's notifications collapsed into groups of matching
-- `(type, deep_link)`. Useful for noisy types like `application_received`
-- where a popular posting generates many identical-target notifications.
--
-- Each group row carries:
--   - group_key      — stable string id, "{type}:{deep_link_or_blank}"
--   - type/title/body/deep_link/created_at/read — from the MOST RECENT member
--   - total_count    — how many notifications are in the group
--   - unread_count   — unread members (for the badge)
--   - latest_id      — id of the most recent member (mark-read shortcut)
--
-- Result ordered by most-recent member desc, capped at 50 groups. Caller
-- narrows further with hat/role filtering in the application layer.
--
-- SECURITY INVOKER + WHERE `person_id = auth.uid()` means RLS and the in-
-- function filter both enforce ownership; a signed-in crew member can only
-- read their own notifications.
-- =============================================================================

create or replace function public.grouped_notifications()
returns table (
  group_key text,
  type text,
  title text,
  body text,
  deep_link text,
  created_at timestamptz,
  read boolean,
  role_context text,
  total_count int,
  unread_count int,
  latest_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      n.type,
      n.title,
      n.body,
      n.deep_link,
      n.created_at,
      n.read,
      n.role_context,
      n.id,
      row_number() over (
        partition by n.type, coalesce(n.deep_link, '')
        order by n.created_at desc
      ) as rn,
      count(*) over (partition by n.type, coalesce(n.deep_link, '')) as g_total,
      sum(case when n.read = false then 1 else 0 end) over (
        partition by n.type, coalesce(n.deep_link, '')
      ) as g_unread
    from public.notifications n
    where n.person_id = auth.uid()
  )
  select
    ranked.type || ':' || coalesce(ranked.deep_link, '') as group_key,
    ranked.type,
    ranked.title,
    ranked.body,
    ranked.deep_link,
    ranked.created_at,
    ranked.read,
    ranked.role_context,
    ranked.g_total::int as total_count,
    ranked.g_unread::int as unread_count,
    ranked.id as latest_id
  from ranked
  where ranked.rn = 1
  order by ranked.created_at desc
  limit 50;
$$;

grant execute on function public.grouped_notifications() to authenticated;
