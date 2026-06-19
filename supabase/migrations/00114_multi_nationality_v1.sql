-- Multi-nationality V1 — schema prep
--
-- Adds `nationality_ids uuid[]` column to profiles to support users with
-- multiple passports (e.g. British + South African). Existing single-value
-- `nationality_id` column is kept for backward compatibility — projection
-- + read paths migrate in a follow-up so old running code doesn't break
-- mid-deploy. A future migration drops `nationality_id` once all reads
-- migrate.
--
-- Backfill: for every profile with a non-null nationality_id, seed
-- nationality_ids = array[nationality_id] so the new column is populated
-- before any read paths look at it.

alter table public.profiles
  add column if not exists nationality_ids uuid[] not null default '{}';

update public.profiles
set nationality_ids = array[nationality_id]
where nationality_id is not null
  and (nationality_ids is null or array_length(nationality_ids, 1) is null);

-- GIN index — supports future "find crew with nationality X" filters.
create index if not exists idx_profiles_nationality_ids
  on public.profiles using gin (nationality_ids);
