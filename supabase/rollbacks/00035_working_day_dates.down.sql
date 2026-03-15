-- Rollback migration 00035: Working Day Dates
alter table public.dayworks drop column if exists working_day_dates;
alter table public.daywork_templates drop column if exists working_day_dates;
