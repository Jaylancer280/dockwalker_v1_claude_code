# Marina Dataset Extraction — DockWalker Integration Spec

> **Purpose:** Populate DockWalker's canonical `regions` / `cities` / `ports` tables with global marina data from OpenStreetMap. The scraper output plugs directly into the same tables that power availability, daywork postings, permanent postings, crew experiences, and the shared `LocationPicker` component.
>
> **Drop the prompt file at:** `scripts/marina-extraction/MARINA_EXTRACT_PROMPT.md`

---

## DockWalker Integration — Current State

### Schema (live in Supabase)

```sql
public.regions  (id uuid pk, name text unique, sort_order int)
public.cities   (id uuid pk, region_id uuid fk→regions, name text, sort_order int, unique(region_id, name))
public.ports    (id uuid pk, city_id   uuid fk→cities,  name text, sort_order int, unique(city_id, name))
```

No country field today. "Region" is an editorial grouping. Current 7 regions: French Riviera, Mallorca, South Florida, Caribbean, Bahamas, UAE, Turkey — hand-curated launch hubs. ~29 cities, ~67 ports across them (see `supabase/seed/001_canonical_data.sql` lines 5-146).

### Foreign-key references that must survive any migration

Every place in the schema where port/city UUIDs are consumed:

| Table                    | Column             | FK target |
| ------------------------ | ------------------ | --------- |
| `profiles`               | `location_port_id` | ports     |
| `profiles`               | `location_city_id` | cities    |
| `dayworks`               | `location_port_id` | ports     |
| `permanent_postings`     | `port_id`          | ports     |
| `availability_windows`   | `city_id`          | cities    |
| `availability_windows`   | `port_id`          | ports     |
| `agent_placement_cities` | `city_id`          | cities    |
| `crew_experiences`       | `location_port_id` | ports     |

Event payloads (`PROFILE.CREATED`, `PROFILE.UPDATED`, `DAYWORK.POSTED`, `PERMANENT.POSTED`, `AVAILABILITY.SET`, `EXPERIENCE.ADDED`, etc.) carry UUIDs in those fields. The event ledger is append-only — **existing UUIDs must be preserved, not regenerated**.

### UI entry points

- `apps/web/src/components/location-picker.tsx` — shared searchable hierarchical picker (Region → City → Port), two modes (`port-required`, `port-optional`). Loads all three tables on mount and filters in-memory.
- `apps/web/src/hooks/use-lookups.tsx` — caches ports + cities in `localStorage` (24h TTL). Does not cache regions (picker loads them directly).
- `apps/web/src/app/(admin)/admin/canonical/page.tsx` — CRUD for regions/cities/ports.

---

## Architectural Decisions

These constrain the extraction and import design. Read before writing code.

### 1. "Region" becomes "Country" — every region UUID is UUIDv5 from country_code

The current 7 regions don't scale to global data. Going forward, **`regions.name` holds an ISO 3166-1 English country name and `regions.country_code` holds the ISO 3166-1 alpha-2 code**. The column name stays `regions` (renaming would churn every event handler, RLS policy, and PostgREST embed) but the semantic is now "country."

**Every region UUID is derived from `uuid5(NS_REGIONS, country_code.upper())`.** No hand-picked preservation, no Caribbean edge case, no subjective calls. The 7 launch region rows get their UUIDs regenerated and `cities.region_id` is migrated to point at the new UUIDs. Old region rows are deleted once orphaned. Regions are editorial groupings with no FK references from profiles/postings/availability/experiences — only `cities.region_id` touches them — so regenerating their UUIDs is safe and gives us a clean invariant: **any region's UUID is recomputable from its country_code alone**.

The 7 launch regions rename as follows (UUIDs regenerate, cities re-parent):

| Current name   | New name                                                                                                                                  | ISO code |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| French Riviera | France                                                                                                                                    | FR       |
| Mallorca       | Spain                                                                                                                                     | ES       |
| South Florida  | United States                                                                                                                             | US       |
| Caribbean      | — (split: cities re-parent to Antigua and Barbuda, Sint Maarten, U.S. Virgin Islands, France [St. Barths is French], Trinidad and Tobago) | —        |
| Bahamas        | Bahamas                                                                                                                                   | BS       |
| UAE            | United Arab Emirates                                                                                                                      | AE       |
| Turkey         | Türkiye                                                                                                                                   | TR       |

Monaco currently sits under "French Riviera" as a city — its `region_id` migrates to the new Monaco region (code `MC`). St. Barths currently under "Caribbean" migrates to France. The migration's pre-step handles all re-parenting atomically before any INSERTs.

Editorial regional groupings ("French Riviera", "South Florida" as a browsing concept) are not lost forever — tracked as V1.1 follow-up via an additive `location_collections` table (see Follow-up scope). They coexist with country as a separate facet.

### 2. UUID preservation for cities and ports is mandatory

**Never delete or regenerate city/port UUIDs.** They're referenced by profile/availability/posting/engagement/experience FKs and by historical event payloads that will replay on any DB reset.

The import migration must:

- Resolve every (country, town) in the scraper output against existing `cities.name` (case-insensitive) before inserting. If match: reuse existing `cities.id`, update `region_id` only if the country remaps.
- Resolve every (country, town, marina) against existing `ports.name` within the matched city before inserting. If match: reuse existing `ports.id`, enrich with `latitude`, `longitude`, `osm_type`, `osm_id`.
- Only INSERT new rows for entities that have no existing match.

Regions are exempt from preservation (no FK references beyond cities; UUIDs deterministically regenerate from country_code).

### 3. Deterministic UUIDv5 for new rows

New region/city/port rows get UUIDv5 generated from a stable namespace. This makes re-running the pipeline idempotent — the same marina produces the same UUID every time, so subsequent runs are upsert-safe.

```python
import uuid
NS_DOCKWALKER = uuid.UUID('7d9e5a60-8b9e-4a8a-9d1e-dockwalker00')  # pick once, never change
NS_REGIONS = uuid.uuid5(NS_DOCKWALKER, 'regions')
NS_CITIES  = uuid.uuid5(NS_DOCKWALKER, 'cities')
NS_PORTS   = uuid.uuid5(NS_DOCKWALKER, 'ports')

region_id = uuid.uuid5(NS_REGIONS, country_code.upper())                                           # e.g. 'GR'
city_id   = uuid.uuid5(NS_CITIES,  f"{country_code.upper()}|{town.lower().strip()}")               # e.g. 'GR|mykonos'
port_id   = uuid.uuid5(NS_PORTS,   f"{country_code.upper()}|{town.lower().strip()}|{name.lower().strip()}")
```

### 4. Name preservation — curated names win

Where an existing port row matches the OSM entry, **keep the existing `name`**. OSM may spell "Port Vauban" as "Vieux Port Vauban" or similar; curated names were chosen for hiring-industry clarity and must not regress.

### 5. LocationPicker scaling + canonical-only selection

20K ports in a single eager Supabase query is a multi-MB client payload. The existing `LocationPicker` will break. Fix scope is **out of this phase** — add to `tasks/todo.md` as a V1.1 follow-up:

- Replace eager load with server-side `/api/locations/search?q=...` returning ranked fuzzy matches across regions/cities/ports
- **Fuzzy search is mandatory** — case-insensitive, diacritic-insensitive (so "Gocek" finds "Göcek"), and typo-tolerant within 1 edit for strings ≥5 chars. Use PostgreSQL `unaccent` + `pg_trgm` similarity on the server (or Fuse.js client-side for cached top-N)
- `useLookups()` drops ports+cities, keeps only the genuinely small lookups (roles, certs, brackets, size bands, nationalities, visa types)
- Picker shows top-N most-used ports (top-200 by usage in profiles+postings) when focused empty; typeahead hits the API after 2 chars
- **Canonical-only selection — no free text anywhere.** If a user can't find their marina, they pick the closest port or the parent city. Helper copy under the picker: _"Can't find your port? Pick the closest one."_ No-results state: _"No match — try the nearest city or port instead."_ This keeps the data layer clean (every FK points at a real canonical row) and avoids a moderation queue
- The 20K marina import should cover every superyacht-relevant location globally; if a gap surfaces, admin adds it via `/admin/canonical` (see Follow-up #7)

For this phase: produce the dataset, import it, and let the picker scale be a tracked follow-up with clear fix path.

---

## Mission — Four-Stage Pipeline

Python pipeline that:

1. Pulls every `leisure=marina` feature from OSM via Overpass (Stage 1)
2. Enriches each record with country / country_code / town via Nominatim reverse-geocoding, tags-first (Stage 2)
3. Deduplicates and produces `marinas.csv` + `marinas.json` (Stage 3)
4. **Generates a Supabase migration** (`NNNNN_marinas_v1_expansion.sql` + rollback) that upserts into `regions` / `cities` / `ports`, preserving existing city and port UUIDs and deterministically regenerating region UUIDs from country codes (Stage 4)

Target volume: ~15,000–25,000 marinas globally after dedup.

## Constraints

- Language: Python 3.10+
- Dependencies: `requests` only (Stages 1-3); stdlib `uuid`, `csv`, `json` (Stage 4)
- License awareness: OSM data is ODbL — DockWalker must attribute "© OpenStreetMap contributors" wherever this data is displayed. Add to the README **and** to the LocationPicker component's empty state or info tooltip.
- Nominatim policy: 1 req/sec hard limit. Set `USER_AGENT` to `"DockWalker-MarinaExtract/1.0 (gareth@nautalink.io)"`.
- Nominatim language: `accept-language=en` on every request to normalise country/town strings.
- Resumability: all stages safely restartable. Stage 1 skips already-downloaded regions. Stage 2 caches every Nominatim response. Stage 4 is idempotent by UUIDv5 construction.
- Overpass reliability: rotate across three mirrors (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`) with exponential backoff on 429/504.

## Directory layout

```
scripts/marina-extraction/
├── MARINA_EXTRACT_PROMPT.md     # this file
├── README.md                    # you will generate
├── requirements.txt             # you will generate
├── 1_extract_marinas.py
├── 2_enrich_locations.py
├── 3_finalize.py
├── 4_generate_migration.py
└── data/                        # gitignored, created at runtime
    ├── regions/                 # per-region raw Overpass JSON
    ├── marinas_raw.json
    ├── marinas_enriched.json
    ├── nominatim_cache.json
    ├── marinas.csv              ← intermediate deliverable (Stage 3)
    ├── marinas.json
    ├── report.txt
    └── migration/
        ├── NNNNN_marinas_v1_expansion.sql     ← FINAL DELIVERABLE (Stage 4)
        └── NNNNN_marinas_v1_expansion.down.sql
```

Add `data/` to `.gitignore`.

The migration files must be manually copied into `supabase/migrations/` and `supabase/rollbacks/` with the correct sequential number (check existing migration count at copy time — last was `00099` at spec-write time).

## Schema changes (pre-migration — must land first)

Stage 4's migration depends on the following columns existing. Ship as a preparatory migration **before** the marina import migration runs:

```sql
-- Preparatory: columns required for marina import
alter table public.regions
  add column country_code char(2) null,
  add column country_code_set_at timestamptz null;

-- Port provenance + geocoordinates (proximity sort, map rendering)
alter table public.ports
  add column latitude  numeric(9, 6) null,
  add column longitude numeric(9, 6) null,
  add column osm_type  text null check (osm_type in ('node','way','relation')),
  add column osm_id    bigint null;

-- Optional enrichment (populated opportunistically from OSM tags)
alter table public.ports
  add column website  text null,
  add column phone    text null,
  add column capacity text null,
  add column vhf      text null;

create index idx_ports_lat_lon on public.ports (latitude, longitude) where latitude is not null;
create unique index idx_ports_osm on public.ports (osm_type, osm_id) where osm_id is not null;
```

Corresponding rollback drops those columns and indexes. Document this as a **separate preparatory migration** before the marina import migration — do not bundle into one file.

---

## Stage 1 — `1_extract_marinas.py`

Pull raw marina data from Overpass, chunked by region.

### Regional bounding boxes

Use these exactly. Format: `(south, west, north, east)`. Sized to stay under Overpass's 10M-element limit:

```python
REGIONS = {
    "europe_west":        (35.0, -12.0, 62.0,   5.0),
    "europe_central":     (35.0,   5.0, 62.0,  20.0),
    "europe_east":        (35.0,  20.0, 62.0,  40.0),
    "scandinavia":        (54.0,   4.0, 72.0,  32.0),
    "mediterranean_east": (30.0,  20.0, 42.0,  37.0),
    "north_africa":       (15.0, -18.0, 37.0,  37.0),
    "middle_east":        (12.0,  32.0, 42.0,  60.0),
    "africa_west":       (-35.0, -20.0, 15.0,  20.0),
    "africa_east":       (-35.0,  20.0, 15.0,  52.0),
    "russia_west":        (40.0,  30.0, 72.0,  60.0),
    "russia_east":        (40.0,  60.0, 80.0, 180.0),
    "central_asia":       (30.0,  45.0, 55.0,  90.0),
    "south_asia":          (5.0,  60.0, 38.0,  98.0),
    "southeast_asia":    (-12.0,  92.0, 28.0, 142.0),
    "east_asia":          (18.0,  98.0, 54.0, 125.0),  # tightened: japan/korea covered separately
    "japan_korea":        (30.0, 125.0, 46.0, 146.0),
    "oceania_au":        (-45.0, 110.0,-10.0, 155.0),
    "oceania_nz":        (-48.0, 165.0,-33.0, 180.0),
    "pacific":           (-30.0, 155.0, 25.0, 180.0),
    "pacific_west":      (-30.0,-180.0, 25.0,-140.0),
    "us_west":            (25.0,-130.0, 50.0,-100.0),
    "us_central":         (25.0,-100.0, 50.0, -85.0),
    "us_east":            (25.0, -85.0, 50.0, -65.0),
    "canada_west":        (48.0,-142.0, 72.0,-100.0),
    "canada_east":        (42.0,-100.0, 72.0, -52.0),
    "alaska":             (52.0,-170.0, 72.0,-130.0),
    "mexico_ca":           (7.0,-118.0, 32.0, -77.0),
    "caribbean":          (10.0, -90.0, 28.0, -58.0),
    "south_america_n":    (-5.0, -82.0, 13.0, -34.0),
    "south_america_s":   (-56.0, -82.0, -5.0, -34.0),
}
```

Note: `east_asia` tightened to stop at 125 E so it doesn't overlap `japan_korea`. Stage 1 dedupe on `(osm_type, osm_id)` still handles residual overlaps in Pacific strips.

### Overpass query template

```python
OVERPASS_QUERY = """
[out:json][timeout:180];
(
  node["leisure"="marina"]({south},{west},{north},{east});
  way["leisure"="marina"]({south},{west},{north},{east});
  relation["leisure"="marina"]({south},{west},{north},{east});
);
out center tags;
"""
```

### Requirements

- POST to Overpass with 240s request timeout
- Retry up to 6 times per region, rotating mirrors each attempt
- On 429/504: sleep `30 * attempt_number` seconds
- On other exceptions: sleep `15 * attempt_number` seconds
- Write each region's response to `data/regions/{region_name}.json` immediately on success
- Skip regions whose file already exists (resumability)
- After all regions complete: merge into `data/marinas_raw.json`, deduplicating by `(osm_type, osm_id)`
- Sleep 2 seconds between regions
- Print progress per region
- Accept `--regions europe_west,mediterranean_east` CLI arg to run a subset for testing

---

## Stage 2 — `2_enrich_locations.py`

Resolve country and town for each marina.

### Strategy (in order)

1. If OSM feature has `addr:country` / `addr:city|town|village|municipality|suburb` tags → use those, no API call.
2. Otherwise → reverse-geocode via Nominatim.

### Nominatim request

- Endpoint: `https://nominatim.openstreetmap.org/reverse`
- Params: `lat, lon, format=json, zoom=12, addressdetails=1, accept-language=en`
- Header: `User-Agent: DockWalker-MarinaExtract/1.0 (gareth@nautalink.io)`
- Timeout: 30s
- Sleep 1.0 seconds after every Nominatim call — **non-negotiable**

### Address-field priority for town

First non-empty wins:

```
city → town → village → municipality → county → suburb
```

Note: `county` above `suburb` — a marina in Camden (suburb) should resolve to the containing county rather than the suburb. Employer search works on town-level, not suburb-level.

### Name handling

- Primary name tag `name` is accepted regardless of script (Greek, Japanese, Arabic, etc. — do not require Latin).
- If `name` is missing, try `name:en` → `name:int` → local variants.
- Only skip records where no name of any kind exists.

### Cache

- File: `data/nominatim_cache.json`
- Key: `f"{round(lat, 4)},{round(lon, 4)}"` (4-decimal rounding avoids redundant calls for near-duplicate points)
- Flush to disk every 50 records processed
- Load cache at startup

### Coordinate extraction

- For `type=node`: use `lat`/`lon` directly
- For `type=way` or `type=relation`: use `center.lat`/`center.lon`

### Skip records that

- Have no resolvable coordinates
- Have no name after all fallbacks exhausted
- Return no country from Nominatim (tag + reverse both failed)

### Output `marinas_enriched.json`

List of records, each:

```json
{
  "osm_type": "node|way|relation",
  "osm_id": 123456,
  "name": "Port Azure",
  "country": "Turkey",
  "country_code": "TR",
  "town": "Göcek",
  "lat": 36.75,
  "lon": 28.93,
  "website": "https://...",
  "phone": "+90...",
  "capacity": "200",
  "vhf": "72",
  "raw_tags": { ... }
}
```

Enrichment fields come from OSM tags: `website` or `contact:website`; `phone` or `contact:phone`; `capacity`; `vhf` or `seamark:harbour:channel`. Normalise `website` to include `https://` scheme if missing.

---

## Stage 3 — `3_finalize.py`

Produce deduplicated dataset.

### Steps

1. Load `marinas_enriched.json`
2. Drop records with no country, no country_code, or no name
3. Deduplicate on `(country_code, town.lower().strip(), name.lower().strip())` — keep the record with the highest richness score (count of non-empty fields in the final column list)
4. Sort by country, then town, then name
5. Write `marinas.csv` with columns in this order:

   ```
   country_code, country, town, name,
   lat, lon, osm_type, osm_id,
   website, phone, capacity, vhf
   ```

6. Write `marinas.json` with the same records (UTF-8, `ensure_ascii=False`, indented)
7. Write `report.txt` containing:
   - Total marina count
   - Records dropped (missing name / country / country_code)
   - Duplicates collapsed
   - Top 30 countries by marina count
   - Hub sanity table: count of marinas in Monaco, Antibes, Palma, Fort Lauderdale, Göcek, Antigua

CSV writer: use `csv.DictWriter`, UTF-8 encoding, `newline=""`.

---

## Stage 4 — `4_generate_migration.py` (new)

Generate the Supabase migration SQL that applies the scraped dataset to `regions` / `cities` / `ports`. Preserves city and port UUIDs by name-match. Regenerates region UUIDs deterministically from country codes.

### Inputs

- `data/marinas.csv`
- Live DB snapshot of existing rows (fetched via `psql` or Supabase client — provide a helper that runs `SELECT id, name FROM regions`, `SELECT id, region_id, name FROM cities`, `SELECT id, city_id, name FROM ports` and dumps to `data/existing_state.json`). Run this helper once at Stage 4 start.

### Country name canonicalization

Before lookups, normalise `country` and `country_code` against the ISO 3166-1 English names list. Nominatim occasionally returns variants ("USA" → "United States", "UK" → "United Kingdom", "Türkiye" vs "Turkey"). Use one canonical English name per code. Ship a small `iso_3166_1.json` lookup file with the Python stdlib `pycountry` equivalent (or hardcode the ~250-country map if avoiding dependencies).

### Algorithm

1. **Load existing state.** Build case-insensitive lookup maps:
   - `existing_cities_by_country_code: {(country_code, name_lower): {id, current_region_id}}` — resolved by deriving each existing city's country via its region's `country_code` (post-remap) or the hardcoded launch-region → country mapping for pre-migration state.
   - `existing_ports_by_city: {(city_id, name_lower): {id, name}}`
   - Hardcoded baseline of original 29 city UUIDs and 67 port UUIDs (for rollback use only).

2. **Emit pre-step: regenerate region UUIDs and re-parent cities.** For each of the 7 launch countries and any additional country encountered in the CSV:
   - Generate target region UUID: `uuid5(NS_REGIONS, country_code.upper())`.
   - If an existing launch region row has a differing UUID, emit: INSERT the new region row with target UUID, UPDATE `cities SET region_id = new_uuid WHERE region_id = old_uuid AND <city belongs in this country>`, DELETE the old region row once all cities have moved.
   - For split cases (Caribbean): each city is reassigned to its actual country's new region UUID based on the hardcoded Caribbean-city → country mapping (Antigua → AG, St. Maarten → SX, St. Thomas → VI, St. Barths → FR, Trinidad → TT).

3. **Walk the CSV country-by-country:**
   - **Region resolve:** `uuid5(NS_REGIONS, country_code.upper())`. INSERT with `on conflict (id) do update set name = excluded.name, country_code = excluded.country_code` — upsert by deterministic UUID. `sort_order` defaults alphabetical by name (rank within the alphabetical list × 10, leaving room for manual overrides). The 7 launch countries keep their existing `sort_order` values if lower than the alphabetical default.
   - **City resolve:** check `existing_cities_by_country_code[(country_code, town.lower())]`. If yes: reuse UUID (UPDATE `region_id` only if it changed during re-parenting). If no: generate `uuid5(NS_CITIES, f"{country_code.upper()}|{town.lower().strip()}")`, INSERT with `sort_order` alphabetical within country.
   - **Port resolve:** check `existing_ports_by_city[(city_id, name.lower())]`. If yes: UPDATE with `latitude`, `longitude`, `osm_type`, `osm_id`, `website`, `phone`, `capacity`, `vhf`. **Do not overwrite `name`** — curated names win. If no: generate `uuid5(NS_PORTS, f"{country_code.upper()}|{town.lower().strip()}|{name.lower().strip()}")`, INSERT with `sort_order` alphabetical within city.

4. **Emit two SQL files:**
   - `NNNNN_marinas_v1_expansion.sql` — dependency-ordered (regions → cities → ports), wrapped in a single transaction. Region regeneration (INSERT new, UPDATE cities, DELETE old) fires first, then the CSV walk.
   - `NNNNN_marinas_v1_expansion.down.sql` — reverse:
     1. DELETE all port rows where `id NOT IN (<original_67_port_uuids>)`
     2. DELETE all city rows where `id NOT IN (<original_29_city_uuids>)`
     3. UPDATE any city rows whose `region_id` changed: restore original `region_id` from hardcoded baseline
     4. DELETE all region rows (they're all UUIDv5-derived, none are original)
     5. INSERT the 7 original launch region rows with original UUIDs, names (`French Riviera`, `Mallorca`, etc.), and `sort_order` from hardcoded baseline
   - The rollback's correctness depends on hardcoded constants — see below.

5. **Print summary:**
   - Regions: X launch renamed, Y new countries added
   - Cities: X existing preserved, Y new
   - Ports: X existing enriched with OSM data, Y new

### Critical: hardcoded baselines

The rollback's correctness and the city re-parenting logic both depend on constants embedded in the Python script (not fetched at runtime — rollback must work against any DB state). Generate once from `supabase/seed/001_canonical_data.sql` and pin in the script:

- `ORIGINAL_REGIONS`: list of 7 `{id, name, sort_order}` objects
- `ORIGINAL_CITIES`: list of 29 `{id, region_id, name, sort_order}` objects
- `ORIGINAL_PORTS`: list of 67 `{id, city_id, name, sort_order}` objects
- `CARIBBEAN_CITY_TO_COUNTRY`: explicit map for splitting the legacy Caribbean region

Include a validation check: before writing migration files, assert the live DB's existing row counts match the hardcoded baseline (`SELECT count(*) FROM regions`, etc.). If mismatch: abort with a clear error — someone has added canonical data since the spec was written, and the baseline needs regenerating.

---

## README.md (generate)

Include:

- One-paragraph purpose statement
- `pip install -r requirements.txt` instruction
- Run sequence with expected duration per stage:
  - Stage 1: 20–40 min
  - Stage 2: several hours globally (resumable; cached Nominatim responses make re-runs fast)
  - Stage 3: seconds
  - Stage 4: seconds (reads CSV + queries live DB once, writes SQL)
- Migration application instructions: copy SQL files to `supabase/migrations/` + `supabase/rollbacks/`, apply with `npx supabase db push`
- Output schema table (the 12 CSV columns with descriptions)
- ODbL attribution note — DockWalker must display "© OpenStreetMap contributors" wherever marina data is shown (picker empty state, about page, or tooltip)
- Verification grep: `grep -i "göcek\|gocek" data/marinas.csv` should show Port Azure, D-Marin Göcek, Skopea Marina, Club Marina as separate rows
- Hub sanity table: Monaco ≥1, Antibes ≥3 (Port Vauban, Port Gallice, Port Camille Rayon), Palma ≥5, Fort Lauderdale ≥20, Antigua ≥3, Göcek ≥3
- Known coverage caveats: OSM is dense in EU/US/AU, thinner in parts of Africa and small Asian states

## requirements.txt

```
requests>=2.31
```

## .gitignore addition

```
scripts/marina-extraction/data/
```

---

## Acceptance criteria

- [ ] All four scripts parse clean (`python -m py_compile`)
- [ ] Stage 1 resumes correctly if interrupted mid-run (test by Ctrl+C and re-running)
- [ ] Stage 1 supports `--regions X,Y` flag for partial runs
- [ ] Stage 2 cache is loaded on startup and written at completion
- [ ] Stage 2 uses `accept-language=en` and accepts non-Latin-script names
- [ ] Stage 2 town priority is `city → town → village → municipality → county → suburb`
- [ ] Stage 3 hub sanity table in `report.txt` shows Monaco ≥1, Antibes ≥3, Palma ≥5, Fort Lauderdale ≥20, Göcek ≥3, Antigua ≥3
- [ ] Stage 4 produces a migration SQL file that:
  - Preserves all 67 existing port UUIDs (matched by `(city, name)` case-insensitive)
  - Preserves all 29 existing city UUIDs (matched by `(country_code, name)` case-insensitive)
  - Regenerates all region UUIDs via `uuid5(NS_REGIONS, country_code.upper())` and re-parents cities to the new region UUIDs atomically
  - Splits the legacy Caribbean region into per-country regions (AG, SX, VI, FR, TT) with cities re-parented
  - Canonicalizes country names to ISO 3166-1 English (no "Türkiye"/"Turkey" mix)
  - Sort orders new rows alphabetically within their parent (regions by name, cities within country, ports within city)
  - Does not overwrite existing port `name` values (curated names win)
  - Uses UUIDv5 for all new UUIDs from a stable namespace
- [ ] Rollback SQL restores the DB to the exact state before the migration (original 7 region UUIDs, 29 city UUIDs, 67 port UUIDs and their names, region_ids, and sort_orders all back in place — hardcoded baselines)
- [ ] **Idempotent re-run:** running Stage 4 a second time against an already-imported DB must produce a no-op migration. Validate by: (1) run Stage 4 → apply migration, (2) run Stage 4 again against the same DB → the generated SQL file should contain zero INSERTs and only UPDATEs with unchanged values (or, preferred: the generator detects zero deltas and writes an empty migration with just a comment). This verifies the UUIDv5 + match-then-enrich design is stable across re-runs and that future re-syncs (quarterly/yearly) are safe.
- [ ] Report shows counts of matched-existing vs new for regions, cities, ports
- [ ] README includes the ODbL attribution requirement and its rendering surfaces (LocationPicker empty state, about page, or tooltip)
- [ ] No hardcoded API keys or secrets
- [ ] `data/` is in `.gitignore`

## What NOT to do

- Do not attempt a single planet-wide Overpass query. It will timeout or be rejected.
- Do not exceed Nominatim's 1 req/sec rate.
- Do not use a paid geocoding API unless explicitly approved. Nominatim is free and sufficient.
- Do not deduplicate on OSM ID alone. Some marinas exist as both a node and a polygon — dedup on the `(country_code, town, name)` tuple.
- Do not drop the `raw_tags` from the enriched JSON. It is useful for future field extraction (berth capacity, fuel, etc.) without re-scraping.
- Do not commit the `data/` directory.
- **Do not regenerate UUIDs for existing cities or ports under any circumstances.** FK references on `profiles`, `dayworks`, `permanent_postings`, `availability_windows`, `agent_placement_cities`, `crew_experiences`, and every historical event payload depend on stability. The match-then-enrich pattern exists to prevent this.
- **Do not overwrite existing port `name` values with OSM variants.** Curated names (e.g. "Port Vauban", "Atlantis Marina") are chosen for hiring-industry clarity. OSM may have "Vieux Port Vauban" or "Atlantis Paradise Island Marina" — ignore the OSM `name` when the row already exists.
- Do not merge Stage 4 migration into an existing migration file. It is a standalone migration with its own number and rollback.
- Do not skip the preparatory schema migration (adding `country_code` to regions, `latitude/longitude/osm_type/osm_id` to ports). Without those columns, Stage 4's SQL will fail on the first INSERT.
- **Do not add a free-text location input anywhere in the app.** Every location FK must point at a canonical `ports.id` or `cities.id`. Users who can't find their marina pick the closest canonical entry; admins add missing marinas via `/admin/canonical`. No `location_other_text`, no "Other, please specify" fields, no port_requests queue.

---

## Follow-up scope (NOT in this phase)

Track as separate items in `tasks/todo.md`:

1. **`LocationPicker` scaling + fuzzy search (P0, blocking at import)** — eager load of all ports fails at 20K rows. Replace with server-side `/api/locations/search?q=...` returning ranked fuzzy matches across regions/cities/ports. Fuzzy match is case-insensitive, diacritic-insensitive ("Gocek" finds "Göcek"), and typo-tolerant within 1 edit for strings ≥5 chars. Implementation: enable PostgreSQL `unaccent` + `pg_trgm` extensions; search endpoint uses `similarity(unaccent(name), unaccent(q)) > 0.3` ranked by score. Drop ports+cities from `useLookups`. Picker shows top-N most-used ports on focus (by count of referencing profiles/postings); typeahead hits the API after 2 chars. Helper copy: _"Can't find your port? Pick the closest one."_ No-results state: _"No match — try the nearest city or port instead."_ **Canonical-only selection, no free text.** Must ship alongside the marina import or users will see a broken picker.

2. **Editorial collections via `location_collections` table** — additive schema for editorial groupings that coexist with countries:

   ```sql
   create table public.location_collections (
     id uuid primary key default uuid_generate_v4(),
     name text not null unique,
     sort_order int not null default 0
   );
   create table public.location_collection_cities (
     collection_id uuid references public.location_collections(id) on delete cascade,
     city_id uuid references public.cities(id) on delete cascade,
     primary key (collection_id, city_id)
   );
   ```

   Seed with "French Riviera" (Antibes, Cannes, Nice, Villefranche, Monaco, Golfe-Juan), "South Florida" (FTL, Dania Beach, West Palm), "Balearic Islands" (Palma, Alcudia, Ibiza), "Caribbean" (all legacy Caribbean cities). Picker gets a "Popular regions" chip row above the country list. Purely additive — no FK churn, no picker-core changes.

3. **Admin OSM-ID pre-fill for new ports (P2)** — when an admin adds a new port via `/admin/canonical`, a "Lookup OSM" button calls `/api/locations/osm-lookup?name=X&city=Y` server-side (rate-limited Nominatim search) and pre-fills lat/lon/osm_id/website/phone. Saves data entry time and keeps provenance consistent. Admin is the only path for adding missing ports (users don't request) — a missing marina = admin-adds-via-canonical-CRUD.

4. **Proximity sort on daywork discover** — now that ports have `latitude`/`longitude`, the sort-by-distance factor mentioned in `CLAUDE.md § Sorting` becomes implementable. Haversine in SQL against the viewer's `location_city_id` centroid.

5. **OSM re-sync cadence** — decide whether to re-run the pipeline quarterly/yearly to pick up new marinas. Stage 4's idempotent UUIDv5 design makes this a one-command operation.

6. **Admin canonical CRUD adjustments (ship with import)** — add `country_code` input to region edit form (required, ISO-3166-1 alpha-2), add `latitude/longitude/osm_type/osm_id/website/phone/capacity/vhf` to port edit form (all optional). Add country dropdown to city add form.

7. **ODbL attribution surfaces** — add "© OpenStreetMap contributors" to LocationPicker info tooltip and `/about` or `/legal` page.

---

## Quote-back requirement

Before writing any code, the coding agent must confirm in one line that it understands:

(a) the four-stage pipeline (extract → enrich → finalise → **migration-generate**)
(b) the regional chunking strategy
(c) the tags-first-then-Nominatim enrichment pattern
(d) the dedup key is `(country_code, town, name)` not OSM ID
(e) **existing city and port UUIDs must be preserved by name-match, never regenerated** — this is the most important invariant
(f) **curated port names win over OSM names** when a match exists

Then proceed.
