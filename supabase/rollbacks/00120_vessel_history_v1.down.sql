-- Rollback for 00120_vessel_history_v1.sql
--
-- Drops the new history tables (CASCADE → drops their RLS policies
-- and indexes), drops the new columns + constraints + indexes on
-- `vessels`. The pg_trgm extension is left in place — earlier
-- migrations (00102) already require it.

drop table if exists public.vessel_flag_states cascade;
drop table if exists public.vessel_names cascade;

drop index if exists public.idx_vessels_hidden_at;
drop index if exists public.idx_vessels_pending_created;

alter table public.vessels drop constraint if exists vessels_beam_check;
alter table public.vessels drop constraint if exists vessels_gross_tonnage_check;
alter table public.vessels drop constraint if exists vessels_year_built_check;
alter table public.vessels drop constraint if exists vessels_source_check;

alter table public.vessels
  drop column if exists submitted_by,
  drop column if exists hidden_at,
  drop column if exists source,
  drop column if exists flag_state_id,
  drop column if exists builder,
  drop column if exists year_built,
  drop column if exists beam_meters,
  drop column if exists gross_tonnage;
