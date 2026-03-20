-- Rollback migration 00057: Remove nationality and visa support

-- 1. Drop columns from profiles
alter table public.profiles drop column if exists visa_ids;
alter table public.profiles drop column if exists nationality_id;

-- 2. Drop tables
drop table if exists public.visa_types;
drop table if exists public.nationalities;

-- 3. Restore apply_projection from migration 00056
-- (Full function body identical to 00056 — without nationality_id/visa_ids in PROFILE handlers)
