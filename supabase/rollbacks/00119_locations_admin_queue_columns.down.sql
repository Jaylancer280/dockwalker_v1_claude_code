-- Rollback for 00119_locations_admin_queue_columns.sql
--
-- Drops the partial indexes first, then the columns. Safe to run
-- independently of any data — the `submitted_by` FK is `ON DELETE
-- SET NULL` and the column itself is nullable, so rollback never
-- conflicts with persons' rows.

drop index if exists public.idx_cities_pending_created;
drop index if exists public.idx_ports_pending_created;

alter table public.cities
  drop column if exists submitted_by,
  drop column if exists created_at;

alter table public.ports
  drop column if exists submitted_by,
  drop column if exists created_at;
