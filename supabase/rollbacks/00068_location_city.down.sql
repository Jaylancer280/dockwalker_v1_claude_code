-- Rollback: drop location_city_id column and supplementary trigger
drop trigger if exists trg_location_city_from_event on public.events;
drop function if exists apply_location_city_from_event();
alter table public.profiles drop column if exists location_city_id;
