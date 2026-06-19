-- Rollback: drop required_languages columns and trigger
drop trigger if exists trg_required_languages_from_event on public.events;
drop function if exists apply_required_languages_from_event();
alter table public.dayworks drop column if exists required_languages;
alter table public.permanent_postings drop column if exists required_languages;
alter table public.daywork_templates drop column if exists required_languages;
alter table public.permanent_templates drop column if exists required_languages;
