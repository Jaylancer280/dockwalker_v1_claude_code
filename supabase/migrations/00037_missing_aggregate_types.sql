-- =============================================================================
-- Migration 00037: Add missing aggregate_type CHECK values
--
-- 'invitation' (used since Stage 53) and 'experience' (used since Stage 46)
-- were never added to the CHECK constraint on the events table.
-- =============================================================================

alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist', 'invitation', 'experience'));
