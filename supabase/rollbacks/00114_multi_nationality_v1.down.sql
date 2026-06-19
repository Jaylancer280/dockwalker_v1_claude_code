-- Rollback for 00114_multi_nationality_v1.sql
--
-- Drops the GIN index and the array column. nationality_id (single) is
-- left intact — the up-migration didn't touch it.

drop index if exists public.idx_profiles_nationality_ids;

alter table public.profiles drop column if exists nationality_ids;
