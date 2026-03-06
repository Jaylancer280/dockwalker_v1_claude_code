-- Rollback: 00001_events_table.sql
-- Drops events table, triggers, function, and indexes

drop trigger if exists events_no_delete on public.events;
drop trigger if exists events_no_update on public.events;
drop function if exists public.prevent_event_mutation();
drop index if exists idx_events_aggregate;
drop index if exists idx_events_person;
drop index if exists idx_events_type;
drop index if exists idx_events_created;
drop policy if exists "Users can insert events as themselves" on public.events;
drop policy if exists "Users can read events they created" on public.events;
drop table if exists public.events;
