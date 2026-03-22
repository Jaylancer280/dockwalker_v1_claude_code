drop trigger if exists trg_deck_name_from_event on public.events;
drop function if exists apply_deck_name_from_event();
alter table public.profiles drop column deck_name;
