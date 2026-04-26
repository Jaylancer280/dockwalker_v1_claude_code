-- Rollback for 00115_certification_bundles_v1.sql
--
-- Drops the junction table. RLS policy and FK constraints fall with it.

drop table if exists public.certification_components;
