-- Locations V2 — Wave D admin queue support columns
--
-- Adds `created_at timestamptz` and `submitted_by uuid` to `cities` and
-- `ports` so the `/admin/locations/pending` queue can:
--   * order pending submissions by recency,
--   * show which user submitted each row.
--
-- Both columns are NULL-safe for existing rows. `created_at` defaults to
-- `now()` at migration time for the back-fill — historical timestamps
-- aren't recoverable for canonical rows imported from OSM, and we only
-- read this column for `source='pending'` rows in the admin queue, so
-- the back-fill timestamp is irrelevant for production reads.
-- `submitted_by` stays NULL for everything except future pending
-- submissions inserted via `/api/locations/request`.

-- ── cities ──────────────────────────────────────────────────────────
alter table public.cities
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists submitted_by uuid null references public.persons(id) on delete set null;

create index if not exists idx_cities_pending_created
  on public.cities (created_at desc)
  where source = 'pending';

-- ── ports ───────────────────────────────────────────────────────────
alter table public.ports
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists submitted_by uuid null references public.persons(id) on delete set null;

create index if not exists idx_ports_pending_created
  on public.ports (created_at desc)
  where source = 'pending';
