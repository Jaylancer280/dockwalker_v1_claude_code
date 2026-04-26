-- Rollback for 00117_locations_pending_v1.sql
--
-- Drops `hidden_at` columns and reverts `source` CHECKs to the prior
-- two-value form (curated | osm). Any rows with source='pending' must
-- be deleted or re-classified BEFORE this rollback runs — otherwise
-- the CHECK re-add will fail.

-- Cities
alter table public.cities drop column if exists hidden_at;
alter table public.cities drop constraint if exists cities_source_check;
alter table public.cities
  add constraint cities_source_check check (source in ('curated', 'osm'));

-- Ports
alter table public.ports drop column if exists hidden_at;
alter table public.ports drop constraint if exists ports_source_check;
alter table public.ports
  add constraint ports_source_check check (source in ('curated', 'osm'));
