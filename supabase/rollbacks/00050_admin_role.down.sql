-- =============================================================================
-- Rollback 00050: Remove admin role
-- =============================================================================

-- Drop is_admin column
alter table public.persons drop column if exists is_admin;

-- Clean up admin events before tightening CHECK constraint
ALTER TABLE public.events DISABLE TRIGGER prevent_event_mutation;
DELETE FROM public.events WHERE aggregate_type = 'admin';
ALTER TABLE public.events ENABLE TRIGGER prevent_event_mutation;

-- Restore previous CHECK constraint (without 'admin')
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist', 'invitation', 'experience'));
