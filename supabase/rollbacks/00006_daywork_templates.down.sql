-- Rollback: 00006_daywork_templates.sql
-- Drops templates table, policies, and index

drop index if exists idx_daywork_templates_person;
drop policy if exists "Users can delete own templates" on public.daywork_templates;
drop policy if exists "Users can insert own templates" on public.daywork_templates;
drop policy if exists "Users can read own templates" on public.daywork_templates;
drop table if exists public.daywork_templates;
