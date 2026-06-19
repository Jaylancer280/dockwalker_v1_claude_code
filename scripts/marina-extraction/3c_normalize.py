"""Stage 3c — Normalize town + country_code values in marinas.csv / marinas.json.

Reads  data/marinas.csv + data/marinas.json (post-3b filter output)
Writes data/marinas.csv + data/marinas.json (in-place; pre-normalize state
       already preserved in data/marinas.prefilter.*)

Normalization rules (focused on the 7 launch-region hubs):
  1. Country-code fixes — CSVs where Nominatim returned the wrong country
     for a known jurisdiction (e.g. NL|Sint Maarten → SX|Sint Maarten).
  2. Town aliasing — map OSM-returned district/province names onto the
     canonical hub city used by DockWalker's curated dataset, so match-then
     enrich in Stage 4 actually hits the existing city UUIDs instead of
     creating near-duplicates.

Both rule sets are loaded from `supabase/seed/marina_aliases.json` so
admins can extend them without touching this script. Anything outside
the configured hub clusters is left alone — the fuzzy search in
LocationPicker will find marinas by name regardless.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CSV_PATH = DATA_DIR / "marinas.csv"
JSON_PATH = DATA_DIR / "marinas.json"
ALIASES_PATH = (
    Path(__file__).parent.parent.parent / "supabase" / "seed" / "marina_aliases.json"
)


def load_aliases() -> tuple[
    dict[tuple[str, str], tuple[str, str]],
    dict[str, dict[str, str]],
]:
    """Read marina_aliases.json and return (country_code_fixes, town_aliases)
    in the in-memory shape the rest of the script expects."""
    with ALIASES_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    country_code_fixes: dict[tuple[str, str], tuple[str, str]] = {}
    for entry in raw.get("country_code_fixes", []):
        key = (entry["from_country_code"], entry["from_country_name_lower"])
        country_code_fixes[key] = (entry["to_country_code"], entry["to_country_name"])

    town_aliases: dict[str, dict[str, str]] = raw.get("town_aliases", {})
    return country_code_fixes, town_aliases


def load_records() -> list[dict]:
    with JSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_records(records: list[dict]) -> None:
    CSV_COLUMNS = [
        "country_code", "country", "town", "name",
        "lat", "lon", "osm_type", "osm_id",
        "website", "phone", "capacity", "vhf",
    ]
    records_sorted = sorted(records, key=lambda r: (r["country"], r["town"], r["name"]))
    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for rec in records_sorted:
            writer.writerow({c: rec.get(c, "") for c in CSV_COLUMNS})
    with JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(records_sorted, f, ensure_ascii=False, indent=2)


def main() -> int:
    if not CSV_PATH.exists():
        print("Missing marinas.csv - run Stage 3 + 3b first", file=sys.stderr)
        return 2
    if not ALIASES_PATH.exists():
        print(f"Missing alias config at {ALIASES_PATH}", file=sys.stderr)
        return 2

    country_code_fixes, town_aliases_map = load_aliases()
    records = load_records()
    country_fixes = 0
    town_aliases = 0

    for r in records:
        cc = (r.get("country_code") or "").upper()
        country = (r.get("country") or "").strip()
        town = (r.get("town") or "").strip()

        # 1. Country-code fix.
        key = (cc, country.lower())
        if key in country_code_fixes:
            new_cc, new_country = country_code_fixes[key]
            r["country_code"] = new_cc
            r["country"] = new_country
            cc = new_cc
            country = new_country
            country_fixes += 1

        # 2. Town alias.
        aliases = town_aliases_map.get(cc, {})
        if aliases:
            alias = aliases.get(town.lower())
            if alias and alias != town:
                r["town"] = alias
                town_aliases += 1

    write_records(records)

    print(f"OK   normalized {len(records)} records")
    print(f"  country-code fixes: {country_fixes}")
    print(f"  town aliases:       {town_aliases}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
