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

Anything outside these hub clusters is left alone. The fuzzy search in
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

# ---------------------------------------------------------------------
# Country-code corrections for CSV rows where Nominatim got confused.
# Keyed by (country_code_from_csv, country_name_from_csv_lowercased).
# ---------------------------------------------------------------------

COUNTRY_CODE_FIXES: dict[tuple[str, str], tuple[str, str]] = {
    # Nominatim sometimes returns NL for Sint Maarten (constituent of the
    # Kingdom of the Netherlands). Force to the SX ISO code.
    ("NL", "sint maarten"): ("SX", "Sint Maarten"),
}

# ---------------------------------------------------------------------
# Town aliases per country. Keys are lowercased OSM-returned town names;
# values are the canonical DockWalker city name for that hub.
# ---------------------------------------------------------------------

TOWN_ALIASES: dict[str, dict[str, str]] = {
    "FR": {
        # Juan-les-Pins is a neighbouring commune administratively part of
        # Antibes — curated port "Port Gallice" lives under Antibes.
        "juan-les-pins": "Antibes",
    },
    "ES": {
        # OSM commonly returns the long form "Palma de Mallorca"; curated
        # city is "Palma".
        "palma de mallorca": "Palma",
    },
    "AE": {
        # Dubai districts.
        "deira": "Dubai",
        "jumeirah": "Dubai",
        "al seef": "Dubai",
        "al satwa": "Dubai",
        "port rashid": "Dubai",
        "umm hurair 2": "Dubai",
        # Abu Dhabi districts.
        "al bateen": "Abu Dhabi",
        "al bahyah": "Abu Dhabi",
        "al hidayriyyat": "Abu Dhabi",
        "yas island": "Abu Dhabi",
        "mina zayed": "Abu Dhabi",
        # Ras Al Khaimah districts.
        "al jazirah al hamra": "Ras Al Khaimah",
    },
    "SX": {
        "philipsburg": "St. Maarten",
        "simpson bay": "St. Maarten",
        "cole bay": "St. Maarten",
    },
    "VI": {
        "charlotte amalie": "St. Thomas (USVI)",
        "frenchtown": "St. Thomas (USVI)",
    },
    "AG": {
        # English Harbour / Falmouth Harbour / St. John's are the three main
        # Antigua locations. Curated city is "Antigua" (island-level).
        "english harbour": "Antigua",
        "falmouth": "Antigua",
        "falmouth harbour": "Antigua",
        "st. john's": "Antigua",
        "st johns": "Antigua",
        "jolly harbour": "Antigua",
        "parish of saint paul": "Antigua",
        "parish of saint john": "Antigua",
    },
    "BS": {
        "new providence": "Nassau",
        "new providence island": "Nassau",
    },
    "TR": {
        # Curated Turkish cities are: Gocek, Marmaris, Bodrum, Fethiye, Antalya.
        # OSM often returns district/province names. Map the well-known hub
        # districts onto their parent city. "Muğla" province spans several
        # hubs so we leave it; Bodrum district names are merged into Bodrum.
        "turgutreis": "Bodrum",
        "yalıkavak": "Bodrum",
        "yalikavak": "Bodrum",
        "gümüşlük": "Bodrum",
        "gumusluk": "Bodrum",
        "göltürkbükü": "Bodrum",
        "golturkbuku": "Bodrum",
        "ortakent": "Bodrum",
        "konacık": "Bodrum",
        "konacik": "Bodrum",
        # Unicode normalisation — İstanbul (dotted I) and Istanbul are the
        # same city; collapse to ASCII so the picker doesn't show two rows.
        "i̇stanbul": "Istanbul",
        "İstanbul": "Istanbul",
        # Göcek is in Muğla province; if Nominatim labelled a Göcek marina
        # as just "Muğla" we leave it — caller can't distinguish Göcek from
        # Bodrum without lat/lon proximity, out of scope for V1.
    },
}


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

    records = load_records()
    country_fixes = 0
    town_aliases = 0

    for r in records:
        cc = (r.get("country_code") or "").upper()
        country = (r.get("country") or "").strip()
        town = (r.get("town") or "").strip()

        # 1. Country-code fix.
        key = (cc, country.lower())
        if key in COUNTRY_CODE_FIXES:
            new_cc, new_country = COUNTRY_CODE_FIXES[key]
            r["country_code"] = new_cc
            r["country"] = new_country
            cc = new_cc
            country = new_country
            country_fixes += 1

        # 2. Town alias.
        aliases = TOWN_ALIASES.get(cc, {})
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
