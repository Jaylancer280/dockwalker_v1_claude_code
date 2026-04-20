-- Rollback for 00101_locations_v1_preparatory.sql
--
-- Drops the geo/OSM columns and country_code. Self-contained — no manual steps.

drop index if exists public.idx_ports_osm;
drop index if exists public.idx_ports_lat_lon;

alter table public.ports
  drop column if exists vhf,
  drop column if exists capacity,
  drop column if exists phone,
  drop column if exists website,
  drop column if exists osm_id,
  drop column if exists osm_type,
  drop column if exists longitude,
  drop column if exists latitude;

alter table public.regions
  drop column if exists country_code;
