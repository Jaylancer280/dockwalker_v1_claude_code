-- Rollback migration 00037: Remove 'invitation' and 'experience' from aggregate_type CHECK
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist'));
