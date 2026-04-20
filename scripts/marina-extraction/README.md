# Marina extraction pipeline

Four-stage Python pipeline that pulls global marina data from OpenStreetMap,
enriches it with Nominatim reverse geocoding, deduplicates, and produces a
Supabase migration that upserts into `regions` / `cities` / `ports` with
**UUID preservation** for all existing canonical rows.

Target output: ~15,000–25,000 marinas globally.

> **ODbL attribution:** OSM data is licensed under the Open Database License.
> DockWalker must display "© OpenStreetMap contributors" wherever this data
> is shown (LocationPicker empty state, About page, or info tooltip).

## Prerequisites

- Python 3.10+ (`python --version`)
- `pip install -r requirements.txt`
- Optional: set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` so Stage 4 can
  validate that the hardcoded baseline matches the live DB before generating
  SQL. Both are in `apps/web/.env.local`.

## Run sequence

See `LOCATIONS_RUNBOOK.md` at the repo root for the complete step-by-step.
Short version:

```bash
cd scripts/marina-extraction
pip install -r requirements.txt
python 1_extract_marinas.py   # 20–40 min
python 2_enrich_locations.py  # several hours (resumable, cached)
python 3_finalize.py          # seconds — inspect data/report.txt
python 4_generate_migration.py  # seconds — writes data/migration/*.sql
```

Then copy `data/migration/NNNNN_marinas_v1_expansion.sql` +
`NNNNN_marinas_v1_expansion.down.sql` into `supabase/migrations/` and
`supabase/rollbacks/` and run `npx supabase db push`.

## Output schema

`data/marinas.csv` columns:

| column         | description                                                           |
| -------------- | --------------------------------------------------------------------- |
| `country_code` | ISO 3166-1 alpha-2 (uppercase)                                        |
| `country`      | English country name (Nominatim `accept-language=en`)                 |
| `town`         | Resolved via `city → town → village → municipality → county → suburb` |
| `name`         | Marina name (primary `name` tag; `name:en`, `name:int` fallbacks)     |
| `lat` / `lon`  | Centre coordinates                                                    |
| `osm_type`     | `node` / `way` / `relation`                                           |
| `osm_id`       | OSM element id                                                        |
| `website`      | Normalised to include `https://` scheme                               |
| `phone`        | From `phone` or `contact:phone` tags                                  |
| `capacity`     | OSM `capacity` tag (berth count)                                      |
| `vhf`          | OSM `vhf` or `seamark:harbour:channel`                                |

## Resumability

- **Stage 1** skips any region whose JSON file already exists in
  `data/regions/`. To force re-fetch: delete the file.
- **Stage 2** caches every Nominatim response in
  `data/nominatim_cache.json`, flushed every 50 records. Safe to Ctrl+C
  and resume.
- **Stage 3** is pure re-computation — always safe.
- **Stage 4** is idempotent by UUIDv5 construction. Running it a second
  time against an already-imported DB should produce a migration with no
  INSERTs and only no-op UPDATEs.

## Verification checks

After Stage 3, `data/report.txt` shows a hub sanity table. Expected
minimums:

- Monaco ≥ 1
- Antibes ≥ 3
- Palma ≥ 5
- Fort Lauderdale ≥ 20
- Göcek ≥ 3
- Antigua ≥ 3

If any hub shows 0 or far below expected, investigate before proceeding to
Stage 4.

Also check:

```bash
grep -i "gocek\|göcek" data/marinas.csv  # should include D-Marin Gocek, Marinturk Gocek Village Port
```

## Coverage caveats

OSM is dense in EU / US / AU / Caribbean, thinner in parts of Africa and
small Asian states. Admins add missing marinas via `/admin/canonical`
rather than accepting user-submitted free text.

## Nominatim etiquette

The pipeline sends `User-Agent: DockWalker-MarinaExtract/1.0 (gareth@nautalink.io)`
and sleeps 1 second between every call. Do not reduce the sleep —
Nominatim's policy is 1 req/sec.
