-- Remove sea time trigger and columns
drop trigger if exists trg_sea_time_from_event on public.events;
drop function if exists apply_sea_time_from_event();

alter table public.crew_experiences
  drop column sea_time_days,
  drop column sea_time_nautical_miles;
