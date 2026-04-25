-- Locations V2 — OSM live fallback infrastructure + gap-fill cities
--
-- Adds provenance columns to cities (mirroring what ports already have):
--   * source        ('curated' | 'osm') — default 'curated'
--   * latitude      numeric(9,6) null
--   * longitude     numeric(9,6) null
--   * osm_place_id  text null, unique partial index
-- And the same `source` column on ports for symmetric labeling.
--
-- These columns let the new /api/locations/canonicalize endpoint upsert
-- OSM-sourced cities at search-fallback time without polluting curated rows.
-- Existing rows are backfilled to source='curated' before the CHECK is added.
--
-- Also: targeted gap-fill INSERTs for cities that 3+ users reported missing
-- (Valletta MT, Tortola VG) plus a small set of obvious yacht hubs that the
-- OSM extraction pass missed (Porto Cervo, Portofino, Capri, Split, Phuket,
-- Monte Carlo, Vilamoura). Conflict by (region_id, name) is no-op so the
-- migration is idempotent.

-- ============================================================================
-- Schema additions: cities
-- ============================================================================

alter table public.cities
  add column if not exists source text,
  add column if not exists latitude numeric(9, 6) null,
  add column if not exists longitude numeric(9, 6) null,
  add column if not exists osm_place_id text null;

-- Backfill existing rows to 'curated' before applying NOT NULL + CHECK.
update public.cities set source = 'curated' where source is null;

alter table public.cities
  alter column source set default 'curated',
  alter column source set not null;

-- Drop+re-add CHECK guard idempotently
alter table public.cities drop constraint if exists cities_source_check;
alter table public.cities
  add constraint cities_source_check check (source in ('curated', 'osm'));

create unique index if not exists idx_cities_osm_place_id
  on public.cities (osm_place_id)
  where osm_place_id is not null;

-- ============================================================================
-- Schema additions: ports (just `source` for symmetry)
-- ============================================================================

alter table public.ports
  add column if not exists source text;

update public.ports set source = 'curated' where source is null;

alter table public.ports
  alter column source set default 'curated',
  alter column source set not null;

alter table public.ports drop constraint if exists ports_source_check;
alter table public.ports
  add constraint ports_source_check check (source in ('curated', 'osm'));

-- ============================================================================
-- Gap-fill cities — explicit user reports + obvious yacht-hub omissions.
--
-- Conflict policy: do nothing on (region_id, name) collision so the migration
-- is safe to re-run and won't disturb rows from 00104.
-- ============================================================================

-- Malta — Valletta (capital). User-reported.
insert into public.cities (region_id, name, sort_order, source)
values ('2f8a6da0-fa61-5641-9091-5ebe3b92280f', 'Valletta', 5, 'curated')
on conflict (region_id, name) do nothing;

-- British Virgin Islands — Tortola. User-reported. Tortola is the island,
-- not a city, but multiple users typed it expecting a result. Adding as a
-- discoverability alias under BVI; sort_order 5 puts it above Road Town (30).
insert into public.cities (region_id, name, sort_order, source)
values ('e0abeaa4-1552-5876-892b-b21dc0399daf', 'Tortola', 5, 'curated')
on conflict (region_id, name) do nothing;

-- Italy — Porto Cervo (Costa Smeralda yacht hub), Portofino, Capri.
insert into public.cities (region_id, name, sort_order, source)
values
  ('af36c471-8385-5649-aa0f-fc89b052dc68', 'Porto Cervo', 645, 'curated'),
  ('af36c471-8385-5649-aa0f-fc89b052dc68', 'Portofino', 646, 'curated'),
  ('af36c471-8385-5649-aa0f-fc89b052dc68', 'Capri', 647, 'curated')
on conflict (region_id, name) do nothing;

-- Croatia — Split.
insert into public.cities (region_id, name, sort_order, source)
values ('489b3d7a-baeb-5228-849a-fc18a1612ac4', 'Split', 200, 'curated')
on conflict (region_id, name) do nothing;

-- Thailand — Phuket.
insert into public.cities (region_id, name, sort_order, source)
values ('e43708d2-71e3-5fd7-87ce-7c7dbe08e185', 'Phuket', 100, 'curated')
on conflict (region_id, name) do nothing;

-- Monaco — Monte Carlo + La Condamine (the two principal quartiers).
insert into public.cities (region_id, name, sort_order, source)
values
  ('04a42fdd-167b-5dc2-99cc-b33e3e438b51', 'Monte Carlo', 10, 'curated'),
  ('04a42fdd-167b-5dc2-99cc-b33e3e438b51', 'La Condamine', 20, 'curated')
on conflict (region_id, name) do nothing;

-- Portugal — Vilamoura (Algarve yacht hub).
insert into public.cities (region_id, name, sort_order, source)
values ('9a233adf-96fe-55ff-965a-17ae971078da', 'Vilamoura', 200, 'curated')
on conflict (region_id, name) do nothing;
