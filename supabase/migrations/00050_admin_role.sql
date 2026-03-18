-- =============================================================================
-- Migration 00050: Admin Role
--
-- 1. Add is_admin boolean to persons
-- 2. Add 'admin' to events aggregate_type CHECK constraint
-- =============================================================================

-- 1. Add is_admin column
alter table public.persons add column if not exists is_admin boolean not null default false;

-- 2. Expand aggregate_type CHECK to include 'admin'
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist', 'invitation', 'experience', 'admin'));
