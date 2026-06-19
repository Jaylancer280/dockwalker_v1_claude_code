-- Rollback migration 00036
drop trigger if exists trg_apply_daywork_extended on public.events;
drop function if exists public.apply_daywork_extended();
