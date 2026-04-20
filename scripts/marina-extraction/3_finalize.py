"""Stage 3 — Deduplicate and produce marinas.csv + marinas.json + report.txt.

Dedup key: (country_code, town.lower().strip(), name.lower().strip()).
On collision: keep the record with the highest richness score (count of
non-empty fields in the final CSV column set). raw_tags is kept in the JSON
but excluded from the CSV.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
ENRICHED_IN = DATA_DIR / "marinas_enriched.json"
CSV_OUT = DATA_DIR / "marinas.csv"
JSON_OUT = DATA_DIR / "marinas.json"
REPORT_OUT = DATA_DIR / "report.txt"

CSV_COLUMNS = [
    "country_code",
    "country",
    "town",
    "name",
    "lat",
    "lon",
    "osm_type",
    "osm_id",
    "website",
    "phone",
    "capacity",
    "vhf",
]

HUB_SANITY_TOWNS = ["Monaco", "Antibes", "Palma", "Fort Lauderdale", "Göcek", "Gocek", "Antigua"]


def richness(rec: dict) -> int:
    return sum(1 for col in CSV_COLUMNS if rec.get(col))


def norm(s: str) -> str:
    return (s or "").strip().lower()


def main() -> int:
    if not ENRICHED_IN.exists():
        print(f"Missing {ENRICHED_IN} - run Stage 2 first", file=sys.stderr)
        return 2

    with ENRICHED_IN.open("r", encoding="utf-8") as f:
        records = json.load(f)

    dropped_no_country = 0
    dropped_no_name = 0
    kept: dict[tuple[str, str, str], dict] = {}

    for rec in records:
        if not rec.get("country") or not rec.get("country_code"):
            dropped_no_country += 1
            continue
        if not rec.get("name"):
            dropped_no_name += 1
            continue
        key = (rec["country_code"].upper(), norm(rec["town"]), norm(rec["name"]))
        existing = kept.get(key)
        if existing is None or richness(rec) > richness(existing):
            kept[key] = rec

    duplicates_collapsed = len(records) - len(kept) - dropped_no_country - dropped_no_name

    final_records = sorted(
        kept.values(),
        key=lambda r: (r["country"], r["town"], r["name"]),
    )

    # CSV
    with CSV_OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for rec in final_records:
            writer.writerow({col: rec.get(col, "") for col in CSV_COLUMNS})

    # JSON (includes raw_tags)
    with JSON_OUT.open("w", encoding="utf-8") as f:
        json.dump(final_records, f, ensure_ascii=False, indent=2)

    # report.txt
    country_counts = Counter(rec["country"] for rec in final_records)
    top_countries = country_counts.most_common(30)
    hub_counts: dict[str, int] = {}
    for hub in HUB_SANITY_TOWNS:
        hub_lower = hub.lower()
        hub_counts[hub] = sum(1 for r in final_records if hub_lower in norm(r["town"]))

    lines = []
    lines.append(f"Total marinas: {len(final_records)}")
    lines.append(f"Dropped (missing country/country_code): {dropped_no_country}")
    lines.append(f"Dropped (missing name): {dropped_no_name}")
    lines.append(f"Duplicates collapsed: {duplicates_collapsed}")
    lines.append("")
    lines.append("Top 30 countries by marina count:")
    for country, count in top_countries:
        lines.append(f"  {count:>5}  {country}")
    lines.append("")
    lines.append("Hub sanity:")
    for hub, count in hub_counts.items():
        lines.append(f"  {hub}: {count}")

    REPORT_OUT.write_text("\n".join(lines), encoding="utf-8")

    print(f"OK   {CSV_OUT}")
    print(f"OK   {JSON_OUT}")
    print(f"OK   {REPORT_OUT}")
    print("")
    print("Hub sanity:")
    for hub, count in hub_counts.items():
        print(f"  {hub}: {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
