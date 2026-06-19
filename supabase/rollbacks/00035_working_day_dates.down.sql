-- Rollback migration 00035: Working Day Dates
-- Drop orphaned trigger and function BEFORE dropping columns
drop trigger if exists trg_apply_working_day_dates on public.events;
drop function if exists public.apply_working_day_dates();

alter table public.dayworks drop column if exists working_day_dates;
alter table public.daywork_templates drop column if exists working_day_dates;
