-- Locations V2 schema prep — pending source + hidden_at columns.
--
-- Three layers of fallback for "user can't find their location":
--   1. Canonical search (already live, pg_trgm)
--   2. OSM Nominatim live fallback — auto-canonicalises into source='osm'
--   3. Manual "Request this location" form — inserts source='pending'
--      rows that only the submitting user sees until an admin approves,
--      merges, or hides them.
--
-- This migration extends the `source` CHECK on `cities` and `ports` to
-- include `'pending'`, and adds `hidden_at timestamptz null` so the
-- admin queue can hide unverifiable submissions without rejecting
-- (the submitting user keeps seeing their typed text on their profile;
-- the row just never appears in anyone else's search).

-- Cities ────────────────────────────────────────────────────────────
alter table public.cities drop constraint if exists cities_source_check;
alter table public.cities
  add constraint cities_source_check check (source in ('curated', 'osm', 'pending'));

alter table public.cities
  add column if not exists hidden_at timestamptz null;

-- Ports ─────────────────────────────────────────────────────────────
alter table public.ports drop constraint if exists ports_source_check;
alter table public.ports
  add constraint ports_source_check check (source in ('curated', 'osm', 'pending'));

alter table public.ports
  add column if not exists hidden_at timestamptz null;
