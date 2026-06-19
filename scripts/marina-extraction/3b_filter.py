"""Stage 3b — Apply superyacht-relevance filters to marinas.csv / marinas.json.

Reads  data/marinas.csv + data/marinas.json
Writes data/marinas.csv + data/marinas.json (backed up to .prefilter)
       data/report.txt (replaced)

Filters applied in this order:
  1. Country whitelist — drop inland-heavy and non-yacht-relevant countries
  2. Name heuristic — drop rows whose name doesn't look like a real marina
     (must contain one of: marina, port, harbour, harbor, yacht, haven,
      dockyard, nautico, boatyard, wharf)
  3. Country floor — drop countries that end up with fewer than N marinas
     after filtering (configurable, default 2) — catches stragglers

The launch-region curated ports (French Riviera / Spain / US / Caribbean /
Bahamas / UAE / Turkey) are ALWAYS preserved: even if a row's country is not
in the whitelist, it's kept if its name matches an existing curated port.
"""

from __future__ import annotations

import csv
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CSV_PATH = DATA_DIR / "marinas.csv"
JSON_PATH = DATA_DIR / "marinas.json"
REPORT_PATH = DATA_DIR / "report.txt"

CSV_BACKUP = DATA_DIR / "marinas.prefilter.csv"
JSON_BACKUP = DATA_DIR / "marinas.prefilter.json"

# ---------------------------------------------------------------------
# Country whitelist — superyacht-relevant. Pick aggressively.
# ---------------------------------------------------------------------

COUNTRY_WHITELIST: set[str] = {
    # Mediterranean (primary yacht belt)
    "FR", "ES", "IT", "GR", "TR", "HR", "MC", "MT", "CY", "ME",
    "AL", "SI", "IL", "LB", "EG", "MA", "TN", "DZ", "LY",
    # Atlantic Europe
    "GB", "IE", "PT", "IS", "FO", "GI",
    # Americas — coastal/yacht hubs
    "US", "CA", "MX", "BS", "CU", "DO", "HT", "JM", "KY", "TC",
    "VG", "VI", "AI", "AG", "BB", "DM", "GD", "LC", "VC", "TT",
    "MS", "BQ", "SX", "MF", "BL", "GP", "MQ", "CW", "AW", "BM",
    "PR",
    # South America — coastal
    "BR", "AR", "UY", "CL", "EC", "PE", "CO", "VE", "GY", "SR", "GF",
    # Middle East / Arabian Gulf
    "AE", "SA", "QA", "BH", "KW", "OM", "JO",
    # Indian Ocean
    "MV", "SC", "MU", "RE", "MG", "TZ", "KE", "ZA",
    # Asia Pacific — yacht hubs only
    "TH", "SG", "MY", "ID", "HK", "PH", "VN", "JP",
    # Oceania
    "AU", "NZ", "PF", "NC", "FJ", "VU", "WS", "TO",
}

# Minimum marinas per country after filtering (prune stragglers).
COUNTRY_FLOOR = 2

# Must contain one of these stems (lowercased, space- or word-boundary
# matching is loose — substring is fine because we're filtering generously).
NAME_STEMS: list[str] = [
    "marina",
    "marinas",
    "yacht",
    "port",
    "puerto",
    "porto",
    "harbour",
    "harbor",
    "haven",
    "dockyard",
    "dock",
    "nautico",
    "yat limani",
    "limani",
    "liman",
    "anchorage",
    "boatyard",
    "wharf",
    "quai",
    "quay",
    "ramp",
    "club nautico",
    "yacht club",
]

# Ports from the DockWalker curated baseline (names only, lower-cased). These
# are always kept even if their country/name would otherwise be filtered.
CURATED_PORT_NAMES: set[str] = {
    "port vauban", "port gallice", "vieux port de cannes", "port pierre canto",
    "port de nice", "port de la darse", "port hercules", "port camille rayon",
    "club de mar mallorca", "stp (marina port de mallorca)",
    "real club nautico de palma", "astilleros de mallorca", "port adriano",
    "port d'alcudia", "marina ibiza", "marina botafoch",
    "bahia mar marina", "lauderdale marine center", "pier sixty-six marina",
    "hilton fort lauderdale marina", "las olas marina",
    "derecktor fort lauderdale", "rybovich marina",
    "isle de sol (simpson bay)", "port de plaisance", "bobby's marina",
    "falmouth harbour marina", "nelson's dockyard marina",
    "antigua yacht club marina", "yacht haven grande", "port de gustavia",
    "chaguaramas",
    "nassau yacht haven", "palm cay marina", "atlantis marina",
    "hurricane hole superyacht marina", "old bahama bay marina",
    "staniel cay yacht club", "boat harbour marina",
    "dubai harbour marina", "port rashid marina (d-marin)",
    "dubai marina yacht club", "mina seyahi", "bulgari marina",
    "yas marina", "emirates palace marina", "al hamra marina",
    "d-marin gocek", "marinturk gocek village port", "netsel marmaris marina",
    "yalikavak marina (palmarina)", "bodrum milta marina", "d-marin turgutreis",
    "ece saray marina", "setur antalya marina",
}


def matches_name_heuristic(name: str) -> bool:
    needle = name.lower()
    return any(stem in needle for stem in NAME_STEMS)


def matches_curated(name: str) -> bool:
    return name.strip().lower() in CURATED_PORT_NAMES


def main() -> int:
    if not CSV_PATH.exists() or not JSON_PATH.exists():
        print("Missing marinas.csv/marinas.json - run Stage 3 first", file=sys.stderr)
        return 2

    # Back up pre-filter state once (idempotent).
    if not CSV_BACKUP.exists():
        shutil.copy2(CSV_PATH, CSV_BACKUP)
        shutil.copy2(JSON_PATH, JSON_BACKUP)
        print(f"OK   backed up pre-filter data to *.prefilter.*")
    else:
        print("OK   pre-filter backup already exists, reusing")

    # Read from the backup so re-running the filter is deterministic.
    with JSON_BACKUP.open("r", encoding="utf-8") as f:
        records = json.load(f)

    total_in = len(records)
    kept: list[dict] = []
    drop_country = 0
    drop_name = 0

    for r in records:
        cc = (r.get("country_code") or "").upper()
        name = r.get("name") or ""
        if matches_curated(name):
            kept.append(r)
            continue
        if cc not in COUNTRY_WHITELIST:
            drop_country += 1
            continue
        if not matches_name_heuristic(name):
            drop_name += 1
            continue
        kept.append(r)

    # Apply country floor.
    counts = Counter(r["country_code"].upper() for r in kept)
    low_countries = {cc for cc, n in counts.items() if n < COUNTRY_FLOOR}
    drop_floor = 0
    if low_countries:
        filtered = []
        for r in kept:
            if r["country_code"].upper() in low_countries and not matches_curated(r["name"]):
                drop_floor += 1
                continue
            filtered.append(r)
        kept = filtered

    # Sort for determinism.
    kept.sort(key=lambda r: (r["country"], r["town"], r["name"]))

    # Rewrite CSV.
    CSV_COLUMNS = [
        "country_code", "country", "town", "name",
        "lat", "lon", "osm_type", "osm_id",
        "website", "phone", "capacity", "vhf",
    ]
    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for rec in kept:
            writer.writerow({c: rec.get(c, "") for c in CSV_COLUMNS})

    # Rewrite JSON.
    with JSON_PATH.open("w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, indent=2)

    # Rewrite report.
    country_counts = Counter(r["country"] for r in kept)
    top_countries = country_counts.most_common(30)
    hub_towns = ["Monaco", "Antibes", "Palma", "Fort Lauderdale", "Göcek", "Gocek", "Muğla", "Antigua", "Dubai"]
    hub_counts = {
        hub: sum(1 for r in kept if hub.lower() in (r["town"] or "").lower())
        for hub in hub_towns
    }

    lines = [
        f"Total marinas (post-filter): {len(kept)}",
        f"Total marinas (pre-filter):  {total_in}",
        f"Dropped by country whitelist: {drop_country}",
        f"Dropped by name heuristic:    {drop_name}",
        f"Dropped by country floor:     {drop_floor}",
        "",
        "Top 30 countries (post-filter):",
    ]
    for country, count in top_countries:
        lines.append(f"  {count:>5}  {country}")
    lines.append("")
    lines.append("Hub sanity:")
    for hub, count in hub_counts.items():
        lines.append(f"  {hub}: {count}")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print("")
    print(f"OK   kept {len(kept)}/{total_in}")
    print(f"  dropped country: {drop_country}, name: {drop_name}, floor: {drop_floor}")
    print(f"  report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
