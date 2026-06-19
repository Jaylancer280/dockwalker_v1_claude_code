-- Vessels V2 — Wave A: schema prep
--
-- Adds the temporal layer that real-world yacht ownership churn
-- requires: a vessel's NAME and FLAG STATE change over time, but its
-- IMO number is the immutable anchor (per CLAUDE.md core invariant 2).
-- A crew member's experience on `MY Vessel X` from 2018-2020 (Cayman
-- flag) under IMO 1010545 is historically correct even if that hull
-- is now `MY Vessel Y` (Malta flag).
--
-- This wave ships ONLY the schema. Subsequent waves add:
--   * VESSEL.RENAMED / VESSEL.REFLAGGED / VESSEL.METADATA_UPDATED event
--     types + projection handlers (Wave B, migration 00121)
--   * Manual-add request flow + admin notification (Wave C)
--   * Wire `AddVesselDialog` into the four entry points (Wave D)
--   * `/admin/vessels/pending` curation queue (Wave E)
--   * Display logic: resolve vessel name + flag by experience-date
--     overlap against `vessel_names` / `vessel_flag_states` (Wave F)
--
-- Mirrors the Locations V2 pattern (`source` enum + `hidden_at`).

-- ============================================================================
-- 1. New columns on `vessels`
-- ============================================================================

alter table public.vessels
  add column if not exists gross_tonnage int null,
  add column if not exists beam_meters numeric(6, 2) null,
  add column if not exists year_built int null,
  add column if not exists builder text null,
  -- Denormalised "current" flag state. Updated by the projection when a
  -- new VESSEL.REFLAGGED event with `effective_to=null` lands.
  add column if not exists flag_state_id text null references public.flag_states(id),
  -- Source provenance — mirrors `cities.source` / `ports.source` from
  -- Locations V2. 'curated' = admin-verified, 'user_submitted' = user-
  -- created via experience / posting flow (default for legacy rows),
  -- 'pending' = manual-add submission awaiting admin review.
  add column if not exists source text null,
  add column if not exists hidden_at timestamptz null,
  -- Submitter audit (nullable — legacy rows have no recorded submitter).
  add column if not exists submitted_by uuid null
    references public.persons(id) on delete set null;

-- Backfill existing rows to 'curated' before applying NOT NULL + CHECK.
-- Treating the existing population as approved-by-default keeps the
-- search/discovery surfaces (which Wave F will filter to
-- `source IN ('curated', 'user_submitted')`) unchanged for legacy data.
update public.vessels set source = 'curated' where source is null;

alter table public.vessels
  alter column source set default 'curated',
  alter column source set not null;

alter table public.vessels drop constraint if exists vessels_source_check;
alter table public.vessels
  add constraint vessels_source_check
  check (source in ('curated', 'user_submitted', 'pending'));

-- Year-built sanity. Don't be too restrictive — some superyachts are
-- centenarian classics; lower bound 1850 is generous.
alter table public.vessels drop constraint if exists vessels_year_built_check;
alter table public.vessels
  add constraint vessels_year_built_check
  check (year_built is null or (year_built >= 1850 and year_built <= 2100));

alter table public.vessels drop constraint if exists vessels_gross_tonnage_check;
alter table public.vessels
  add constraint vessels_gross_tonnage_check
  check (gross_tonnage is null or gross_tonnage > 0);

alter table public.vessels drop constraint if exists vessels_beam_check;
alter table public.vessels
  add constraint vessels_beam_check
  check (beam_meters is null or (beam_meters > 0 and beam_meters < 100));

-- Partial index for the admin pending queue (created_at desc filter).
create index if not exists idx_vessels_pending_created
  on public.vessels (created_at desc)
  where source = 'pending';

-- Helpful for the admin queue's "show me hidden submissions" toggle if
-- we add one later, plus prevents the scan-tablespace plan when the
-- search RPC filters by `hidden_at IS NULL`.
create index if not exists idx_vessels_hidden_at
  on public.vessels (hidden_at)
  where hidden_at is not null;

-- ============================================================================
-- 2. `vessel_names` history table — append-only timeline
-- ============================================================================

-- Each row is a single (vessel, name, [effective_from, effective_to))
-- interval. A name with `effective_to is null` is the CURRENT name.
-- Older rows stay forever — they're how Wave F displays the right
-- name on a crew member's historical experience entry.
create table if not exists public.vessel_names (
  id              uuid primary key default uuid_generate_v4(),
  vessel_id       uuid not null references public.vessels(id) on delete cascade,
  name            text not null,
  effective_from  date not null,
  effective_to    date null,
  source          text not null default 'curated'
                  check (source in ('curated', 'user_submitted', 'pending')),
  submitted_by    uuid null references public.persons(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Disallow zero-length intervals; effective_to must be ≥ effective_from
  -- when it's set.
  constraint vessel_names_interval_check
    check (effective_to is null or effective_to >= effective_from)
);

-- Helps `(vessel_id, [effective_from, effective_to))` overlap lookups —
-- the core query Wave F runs to pick the right name for an experience's
-- date range.
create index if not exists idx_vessel_names_vessel_effective
  on public.vessel_names (vessel_id, effective_from desc, effective_to);

-- Fuzzy search across historical names so typing "Sea Wolf" finds a hull
-- that's currently named "Black Pearl" but used to be "Sea Wolf".
create extension if not exists pg_trgm with schema public;
create index if not exists idx_vessel_names_name_trgm
  on public.vessel_names
  using gin (public.immutable_unaccent(lower(name)) gin_trgm_ops);

-- Admin pending queue index (mirrors vessels.idx_vessels_pending_created).
create index if not exists idx_vessel_names_pending_created
  on public.vessel_names (created_at desc)
  where source = 'pending';

-- ============================================================================
-- 3. `vessel_flag_states` history table
-- ============================================================================

create table if not exists public.vessel_flag_states (
  id              uuid primary key default uuid_generate_v4(),
  vessel_id       uuid not null references public.vessels(id) on delete cascade,
  flag_state_id   text not null references public.flag_states(id),
  effective_from  date not null,
  effective_to    date null,
  source          text not null default 'curated'
                  check (source in ('curated', 'user_submitted', 'pending')),
  submitted_by    uuid null references public.persons(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint vessel_flag_states_interval_check
    check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_vessel_flag_states_vessel_effective
  on public.vessel_flag_states (vessel_id, effective_from desc, effective_to);

create index if not exists idx_vessel_flag_states_pending_created
  on public.vessel_flag_states (created_at desc)
  where source = 'pending';

-- ============================================================================
-- 4. RLS — read-only for authenticated, writes via apply_projection
-- ============================================================================
--
-- The history tables follow the same RLS pattern as `vessels`: any
-- authenticated user can read; INSERTs go through `apply_projection`
-- which runs as service role + SECURITY DEFINER. Crew + employers
-- need read access so the picker/profile/posting UIs can resolve
-- historical names by date overlap. NDA logic stays on `vessels` —
-- if `vessels.nda_flag=true` and the caller isn't the owner / engaged,
-- the application layer must mask the name before joining to vessel_names.

alter table public.vessel_names enable row level security;
alter table public.vessel_flag_states enable row level security;

drop policy if exists "Authenticated read vessel_names" on public.vessel_names;
create policy "Authenticated read vessel_names"
  on public.vessel_names for select
  to authenticated
  using (true);

drop policy if exists "Authenticated read vessel_flag_states" on public.vessel_flag_states;
create policy "Authenticated read vessel_flag_states"
  on public.vessel_flag_states for select
  to authenticated
  using (true);

-- ============================================================================
-- 5. Backfill — synthesise an open-ended `vessel_names` record per existing
--    vessel so Wave F's overlap query has something to find for legacy data.
-- ============================================================================

insert into public.vessel_names (vessel_id, name, effective_from, source)
select
  v.id,
  v.name,
  coalesce(v.created_at::date, current_date - interval '5 years')::date,
  'curated'
from public.vessels v
where not exists (
  select 1 from public.vessel_names vn where vn.vessel_id = v.id
);
-- Note: NOT also seeding `vessel_flag_states` — current `vessels` has no
-- flag_state column populated, so we'd be inventing data. Wave B's
-- VESSEL.REFLAGGED handler will start populating from real events.
