"""Stage 4 — Generate the Supabase migration SQL for the marina import.

Reads data/marinas.csv, matches against hardcoded DockWalker baselines for
cities and ports (UUIDs preserved), and writes two SQL files under
data/migration/:

    data/migration/NNNNN_marinas_v1_expansion.sql
    data/migration/NNNNN_marinas_v1_expansion.down.sql

Where NNNNN is determined by scanning supabase/migrations/ for the highest
existing number (+1). After generation, copy the files into
supabase/migrations/ and supabase/rollbacks/ and apply via
`npx supabase db push`.

Dependencies: stdlib only. No Supabase client; the validation check against
live DB row counts is advisory — it uses the Supabase REST API if
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the environment.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

import requests

# -------------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / "data"
MIGRATION_DIR = DATA_DIR / "migration"
CSV_IN = DATA_DIR / "marinas.csv"
STATE_DUMP = DATA_DIR / "existing_state.json"

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"

NS_DOCKWALKER = uuid.UUID("7d9e5a60-8b9e-4a8a-9d1e-7d0ca44e7000")  # stable
NS_REGIONS = uuid.uuid5(NS_DOCKWALKER, "regions")
NS_CITIES = uuid.uuid5(NS_DOCKWALKER, "cities")
NS_PORTS = uuid.uuid5(NS_DOCKWALKER, "ports")

# -------------------------------------------------------------------------
# Hardcoded baselines (from supabase/seed/001_canonical_data.sql, frozen)
# -------------------------------------------------------------------------

ORIGINAL_REGIONS: list[dict[str, Any]] = [
    {"id": "a0000000-0000-0000-0000-000000000001", "name": "French Riviera", "sort_order": 1},
    {"id": "a0000000-0000-0000-0000-000000000002", "name": "Mallorca",       "sort_order": 2},
    {"id": "a0000000-0000-0000-0000-000000000003", "name": "South Florida",  "sort_order": 3},
    {"id": "a0000000-0000-0000-0000-000000000004", "name": "Caribbean",      "sort_order": 4},
    {"id": "a0000000-0000-0000-0000-000000000005", "name": "Bahamas",        "sort_order": 5},
    {"id": "a0000000-0000-0000-0000-000000000006", "name": "UAE",            "sort_order": 6},
    {"id": "a0000000-0000-0000-0000-000000000007", "name": "Turkey",         "sort_order": 7},
]

# Each entry: {"id", "region_id", "name", "sort_order", "country_code"}
ORIGINAL_CITIES: list[dict[str, Any]] = [
    # French Riviera
    {"id": "b0000000-0000-0000-0000-000000000001", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Antibes",              "sort_order": 1, "country_code": "FR"},
    {"id": "b0000000-0000-0000-0000-000000000002", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Cannes",               "sort_order": 2, "country_code": "FR"},
    {"id": "b0000000-0000-0000-0000-000000000003", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Nice",                 "sort_order": 3, "country_code": "FR"},
    {"id": "b0000000-0000-0000-0000-000000000004", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Villefranche-sur-Mer", "sort_order": 4, "country_code": "FR"},
    {"id": "b0000000-0000-0000-0000-000000000005", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Monaco",               "sort_order": 5, "country_code": "MC"},
    {"id": "b0000000-0000-0000-0000-000000000006", "region_id": "a0000000-0000-0000-0000-000000000001", "name": "Golfe-Juan",           "sort_order": 6, "country_code": "FR"},
    # Mallorca
    {"id": "b0000000-0000-0000-0000-000000000010", "region_id": "a0000000-0000-0000-0000-000000000002", "name": "Palma",                "sort_order": 1, "country_code": "ES"},
    {"id": "b0000000-0000-0000-0000-000000000011", "region_id": "a0000000-0000-0000-0000-000000000002", "name": "Alcudia",              "sort_order": 2, "country_code": "ES"},
    {"id": "b0000000-0000-0000-0000-000000000012", "region_id": "a0000000-0000-0000-0000-000000000002", "name": "Ibiza",                "sort_order": 3, "country_code": "ES"},
    # South Florida
    {"id": "b0000000-0000-0000-0000-000000000020", "region_id": "a0000000-0000-0000-0000-000000000003", "name": "Fort Lauderdale",      "sort_order": 1, "country_code": "US"},
    {"id": "b0000000-0000-0000-0000-000000000021", "region_id": "a0000000-0000-0000-0000-000000000003", "name": "Dania Beach",          "sort_order": 2, "country_code": "US"},
    {"id": "b0000000-0000-0000-0000-000000000022", "region_id": "a0000000-0000-0000-0000-000000000003", "name": "West Palm Beach",      "sort_order": 3, "country_code": "US"},
    # Caribbean (splits)
    {"id": "b0000000-0000-0000-0000-000000000030", "region_id": "a0000000-0000-0000-0000-000000000004", "name": "St. Maarten",          "sort_order": 1, "country_code": "SX"},
    {"id": "b0000000-0000-0000-0000-000000000031", "region_id": "a0000000-0000-0000-0000-000000000004", "name": "Antigua",              "sort_order": 2, "country_code": "AG"},
    {"id": "b0000000-0000-0000-0000-000000000032", "region_id": "a0000000-0000-0000-0000-000000000004", "name": "St. Thomas (USVI)",    "sort_order": 3, "country_code": "VI"},
    {"id": "b0000000-0000-0000-0000-000000000033", "region_id": "a0000000-0000-0000-0000-000000000004", "name": "St. Barths",           "sort_order": 4, "country_code": "FR"},
    {"id": "b0000000-0000-0000-0000-000000000034", "region_id": "a0000000-0000-0000-0000-000000000004", "name": "Trinidad",             "sort_order": 5, "country_code": "TT"},
    # Bahamas
    {"id": "b0000000-0000-0000-0000-000000000040", "region_id": "a0000000-0000-0000-0000-000000000005", "name": "Nassau",                "sort_order": 1, "country_code": "BS"},
    {"id": "b0000000-0000-0000-0000-000000000041", "region_id": "a0000000-0000-0000-0000-000000000005", "name": "Paradise Island",       "sort_order": 2, "country_code": "BS"},
    {"id": "b0000000-0000-0000-0000-000000000042", "region_id": "a0000000-0000-0000-0000-000000000005", "name": "Grand Bahama",          "sort_order": 3, "country_code": "BS"},
    {"id": "b0000000-0000-0000-0000-000000000043", "region_id": "a0000000-0000-0000-0000-000000000005", "name": "Exumas",                "sort_order": 4, "country_code": "BS"},
    {"id": "b0000000-0000-0000-0000-000000000044", "region_id": "a0000000-0000-0000-0000-000000000005", "name": "Marsh Harbour (Abacos)","sort_order": 5, "country_code": "BS"},
    # UAE
    {"id": "b0000000-0000-0000-0000-000000000050", "region_id": "a0000000-0000-0000-0000-000000000006", "name": "Dubai",                 "sort_order": 1, "country_code": "AE"},
    {"id": "b0000000-0000-0000-0000-000000000051", "region_id": "a0000000-0000-0000-0000-000000000006", "name": "Abu Dhabi",             "sort_order": 2, "country_code": "AE"},
    {"id": "b0000000-0000-0000-0000-000000000052", "region_id": "a0000000-0000-0000-0000-000000000006", "name": "Ras Al Khaimah",        "sort_order": 3, "country_code": "AE"},
    # Turkey
    {"id": "b0000000-0000-0000-0000-000000000060", "region_id": "a0000000-0000-0000-0000-000000000007", "name": "Gocek",                 "sort_order": 1, "country_code": "TR"},
    {"id": "b0000000-0000-0000-0000-000000000061", "region_id": "a0000000-0000-0000-0000-000000000007", "name": "Marmaris",              "sort_order": 2, "country_code": "TR"},
    {"id": "b0000000-0000-0000-0000-000000000062", "region_id": "a0000000-0000-0000-0000-000000000007", "name": "Bodrum",                "sort_order": 3, "country_code": "TR"},
    {"id": "b0000000-0000-0000-0000-000000000063", "region_id": "a0000000-0000-0000-0000-000000000007", "name": "Fethiye",               "sort_order": 4, "country_code": "TR"},
    {"id": "b0000000-0000-0000-0000-000000000064", "region_id": "a0000000-0000-0000-0000-000000000007", "name": "Antalya",               "sort_order": 5, "country_code": "TR"},
]

# (id, city_id, name, sort_order)
ORIGINAL_PORTS: list[dict[str, Any]] = [
    # Antibes
    {"id": "c0000000-0000-0000-0000-000000000001", "city_id": "b0000000-0000-0000-0000-000000000001", "name": "Port Vauban",                     "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000002", "city_id": "b0000000-0000-0000-0000-000000000001", "name": "Port Gallice",                    "sort_order": 2},
    # Cannes
    {"id": "c0000000-0000-0000-0000-000000000003", "city_id": "b0000000-0000-0000-0000-000000000002", "name": "Vieux Port de Cannes",            "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000004", "city_id": "b0000000-0000-0000-0000-000000000002", "name": "Port Pierre Canto",               "sort_order": 2},
    # Nice
    {"id": "c0000000-0000-0000-0000-000000000005", "city_id": "b0000000-0000-0000-0000-000000000003", "name": "Port de Nice",                    "sort_order": 1},
    # Villefranche
    {"id": "c0000000-0000-0000-0000-000000000006", "city_id": "b0000000-0000-0000-0000-000000000004", "name": "Port de la Darse",                "sort_order": 1},
    # Monaco
    {"id": "c0000000-0000-0000-0000-000000000007", "city_id": "b0000000-0000-0000-0000-000000000005", "name": "Port Hercules",                   "sort_order": 1},
    # Golfe-Juan
    {"id": "c0000000-0000-0000-0000-000000000008", "city_id": "b0000000-0000-0000-0000-000000000006", "name": "Port Camille Rayon",              "sort_order": 1},
    # Palma
    {"id": "c0000000-0000-0000-0000-000000000010", "city_id": "b0000000-0000-0000-0000-000000000010", "name": "Club de Mar Mallorca",            "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000011", "city_id": "b0000000-0000-0000-0000-000000000010", "name": "STP (Marina Port de Mallorca)",   "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000012", "city_id": "b0000000-0000-0000-0000-000000000010", "name": "Real Club Nautico de Palma",      "sort_order": 3},
    {"id": "c0000000-0000-0000-0000-000000000013", "city_id": "b0000000-0000-0000-0000-000000000010", "name": "Astilleros de Mallorca",          "sort_order": 4},
    {"id": "c0000000-0000-0000-0000-000000000014", "city_id": "b0000000-0000-0000-0000-000000000010", "name": "Port Adriano",                    "sort_order": 5},
    # Alcudia
    {"id": "c0000000-0000-0000-0000-000000000015", "city_id": "b0000000-0000-0000-0000-000000000011", "name": "Port d'Alcudia",                  "sort_order": 1},
    # Ibiza
    {"id": "c0000000-0000-0000-0000-000000000016", "city_id": "b0000000-0000-0000-0000-000000000012", "name": "Marina Ibiza",                    "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000017", "city_id": "b0000000-0000-0000-0000-000000000012", "name": "Marina Botafoch",                 "sort_order": 2},
    # Fort Lauderdale
    {"id": "c0000000-0000-0000-0000-000000000020", "city_id": "b0000000-0000-0000-0000-000000000020", "name": "Bahia Mar Marina",                "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000021", "city_id": "b0000000-0000-0000-0000-000000000020", "name": "Lauderdale Marine Center",        "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000022", "city_id": "b0000000-0000-0000-0000-000000000020", "name": "Pier Sixty-Six Marina",           "sort_order": 3},
    {"id": "c0000000-0000-0000-0000-000000000023", "city_id": "b0000000-0000-0000-0000-000000000020", "name": "Hilton Fort Lauderdale Marina",   "sort_order": 4},
    {"id": "c0000000-0000-0000-0000-000000000024", "city_id": "b0000000-0000-0000-0000-000000000020", "name": "Las Olas Marina",                 "sort_order": 5},
    # Dania Beach
    {"id": "c0000000-0000-0000-0000-000000000025", "city_id": "b0000000-0000-0000-0000-000000000021", "name": "Derecktor Fort Lauderdale",       "sort_order": 1},
    # West Palm Beach
    {"id": "c0000000-0000-0000-0000-000000000026", "city_id": "b0000000-0000-0000-0000-000000000022", "name": "Rybovich Marina",                 "sort_order": 1},
    # St. Maarten
    {"id": "c0000000-0000-0000-0000-000000000030", "city_id": "b0000000-0000-0000-0000-000000000030", "name": "Isle de Sol (Simpson Bay)",       "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000031", "city_id": "b0000000-0000-0000-0000-000000000030", "name": "Port de Plaisance",               "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000032", "city_id": "b0000000-0000-0000-0000-000000000030", "name": "Bobby's Marina",                  "sort_order": 3},
    # Antigua
    {"id": "c0000000-0000-0000-0000-000000000033", "city_id": "b0000000-0000-0000-0000-000000000031", "name": "Falmouth Harbour Marina",         "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000034", "city_id": "b0000000-0000-0000-0000-000000000031", "name": "Nelson's Dockyard Marina",        "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000035", "city_id": "b0000000-0000-0000-0000-000000000031", "name": "Antigua Yacht Club Marina",       "sort_order": 3},
    # St. Thomas
    {"id": "c0000000-0000-0000-0000-000000000036", "city_id": "b0000000-0000-0000-0000-000000000032", "name": "Yacht Haven Grande",              "sort_order": 1},
    # St. Barths
    {"id": "c0000000-0000-0000-0000-000000000037", "city_id": "b0000000-0000-0000-0000-000000000033", "name": "Port de Gustavia",                "sort_order": 1},
    # Trinidad
    {"id": "c0000000-0000-0000-0000-000000000038", "city_id": "b0000000-0000-0000-0000-000000000034", "name": "Chaguaramas",                     "sort_order": 1},
    # Nassau
    {"id": "c0000000-0000-0000-0000-000000000040", "city_id": "b0000000-0000-0000-0000-000000000040", "name": "Nassau Yacht Haven",              "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000041", "city_id": "b0000000-0000-0000-0000-000000000040", "name": "Palm Cay Marina",                 "sort_order": 2},
    # Paradise Island
    {"id": "c0000000-0000-0000-0000-000000000042", "city_id": "b0000000-0000-0000-0000-000000000041", "name": "Atlantis Marina",                 "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000043", "city_id": "b0000000-0000-0000-0000-000000000041", "name": "Hurricane Hole Superyacht Marina","sort_order": 2},
    # Grand Bahama
    {"id": "c0000000-0000-0000-0000-000000000044", "city_id": "b0000000-0000-0000-0000-000000000042", "name": "Old Bahama Bay Marina",           "sort_order": 1},
    # Exumas
    {"id": "c0000000-0000-0000-0000-000000000045", "city_id": "b0000000-0000-0000-0000-000000000043", "name": "Staniel Cay Yacht Club",          "sort_order": 1},
    # Marsh Harbour
    {"id": "c0000000-0000-0000-0000-000000000046", "city_id": "b0000000-0000-0000-0000-000000000044", "name": "Boat Harbour Marina",             "sort_order": 1},
    # Dubai
    {"id": "c0000000-0000-0000-0000-000000000050", "city_id": "b0000000-0000-0000-0000-000000000050", "name": "Dubai Harbour Marina",            "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000051", "city_id": "b0000000-0000-0000-0000-000000000050", "name": "Port Rashid Marina (D-Marin)",    "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000052", "city_id": "b0000000-0000-0000-0000-000000000050", "name": "Dubai Marina Yacht Club",         "sort_order": 3},
    {"id": "c0000000-0000-0000-0000-000000000053", "city_id": "b0000000-0000-0000-0000-000000000050", "name": "Mina Seyahi",                     "sort_order": 4},
    {"id": "c0000000-0000-0000-0000-000000000054", "city_id": "b0000000-0000-0000-0000-000000000050", "name": "Bulgari Marina",                  "sort_order": 5},
    # Abu Dhabi
    {"id": "c0000000-0000-0000-0000-000000000055", "city_id": "b0000000-0000-0000-0000-000000000051", "name": "Yas Marina",                      "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000056", "city_id": "b0000000-0000-0000-0000-000000000051", "name": "Emirates Palace Marina",          "sort_order": 2},
    # Ras Al Khaimah
    {"id": "c0000000-0000-0000-0000-000000000057", "city_id": "b0000000-0000-0000-0000-000000000052", "name": "Al Hamra Marina",                 "sort_order": 1},
    # Gocek
    {"id": "c0000000-0000-0000-0000-000000000060", "city_id": "b0000000-0000-0000-0000-000000000060", "name": "D-Marin Gocek",                   "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000061", "city_id": "b0000000-0000-0000-0000-000000000060", "name": "Marinturk Gocek Village Port",    "sort_order": 2},
    # Marmaris
    {"id": "c0000000-0000-0000-0000-000000000062", "city_id": "b0000000-0000-0000-0000-000000000061", "name": "Netsel Marmaris Marina",          "sort_order": 1},
    # Bodrum
    {"id": "c0000000-0000-0000-0000-000000000063", "city_id": "b0000000-0000-0000-0000-000000000062", "name": "Yalikavak Marina (Palmarina)",    "sort_order": 1},
    {"id": "c0000000-0000-0000-0000-000000000064", "city_id": "b0000000-0000-0000-0000-000000000062", "name": "Bodrum Milta Marina",             "sort_order": 2},
    {"id": "c0000000-0000-0000-0000-000000000065", "city_id": "b0000000-0000-0000-0000-000000000062", "name": "D-Marin Turgutreis",              "sort_order": 3},
    # Fethiye
    {"id": "c0000000-0000-0000-0000-000000000066", "city_id": "b0000000-0000-0000-0000-000000000063", "name": "Ece Saray Marina",                "sort_order": 1},
    # Antalya
    {"id": "c0000000-0000-0000-0000-000000000067", "city_id": "b0000000-0000-0000-0000-000000000064", "name": "Setur Antalya Marina",            "sort_order": 1},
]

# Country name → ISO 3166-1 alpha-2 (English canonical name).
# Not exhaustive; covers the 7 launch countries and common Nominatim variants.
# Unknown country codes from OSM pass through as-is; unknown English names are
# looked up in the English-name table below. Nominatim returns lowercased
# ISO codes — we uppercase on read.
COUNTRY_NAME_BY_CODE: dict[str, str] = {
    "FR": "France",
    "ES": "Spain",
    "US": "United States",
    "BS": "Bahamas",
    "AE": "United Arab Emirates",
    "TR": "Türkiye",
    "MC": "Monaco",
    "SX": "Sint Maarten",
    "AG": "Antigua and Barbuda",
    "VI": "United States Virgin Islands",
    "TT": "Trinidad and Tobago",
}


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------


def sql_quote(v: str | None) -> str:
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def sql_num(v: Any) -> str:
    if v is None or v == "":
        return "null"
    return str(v)


def norm_name(s: str) -> str:
    return " ".join(str(s or "").strip().lower().split())


def region_uuid(country_code: str) -> str:
    return str(uuid.uuid5(NS_REGIONS, country_code.upper()))


def city_uuid(country_code: str, town: str) -> str:
    return str(uuid.uuid5(NS_CITIES, f"{country_code.upper()}|{norm_name(town)}"))


def port_uuid(country_code: str, town: str, name: str) -> str:
    return str(uuid.uuid5(NS_PORTS, f"{country_code.upper()}|{norm_name(town)}|{norm_name(name)}"))


def next_migration_number() -> str:
    nums: list[int] = []
    pattern = re.compile(r"^(\d{5})_.*\.sql$")
    if MIGRATIONS_DIR.exists():
        for p in MIGRATIONS_DIR.iterdir():
            m = pattern.match(p.name)
            if m:
                nums.append(int(m.group(1)))
    return f"{(max(nums) + 1) if nums else 101:05d}"


def dump_live_state() -> dict | None:
    """Hit Supabase REST to snapshot existing rows.

    Optional: requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
    If absent, returns None and the script falls back to baseline counts.
    """
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "public"}
    out = {}
    for table, select in (
        ("regions", "id,name,sort_order"),
        ("cities", "id,region_id,name,sort_order"),
        ("ports", "id,city_id,name,sort_order"),
    ):
        resp = requests.get(
            f"{url}/rest/v1/{table}?select={select}",
            headers={**headers, "Range-Unit": "items", "Prefer": "count=exact"},
            timeout=60,
        )
        resp.raise_for_status()
        out[table] = resp.json()
    STATE_DUMP.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def validate_baseline(live: dict | None) -> None:
    if live is None:
        print("  (no SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY - skipping live validation)")
        return
    counts = {t: len(rows) for t, rows in live.items()}
    expected = {"regions": len(ORIGINAL_REGIONS), "cities": len(ORIGINAL_CITIES), "ports": len(ORIGINAL_PORTS)}
    if counts != expected:
        print(f"  ! Live counts {counts} != baseline {expected}", file=sys.stderr)
        print("  The hardcoded baseline in this script is stale - regenerate it from", file=sys.stderr)
        print("  supabase/seed/001_canonical_data.sql before re-running Stage 4.", file=sys.stderr)
        sys.exit(3)
    print(f"  OK   Live counts match baseline ({counts})")


# -------------------------------------------------------------------------
# Migration generation
# -------------------------------------------------------------------------


def build_country_membership(records: list[dict]) -> dict[str, list[dict]]:
    by_country: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        by_country[rec["country_code"].upper()].append(rec)
    return by_country


def alphabetical_sort(items: list[Any], key) -> list[tuple[int, Any]]:
    ordered = sorted(items, key=key)
    return [((i + 1) * 10, item) for i, item in enumerate(ordered)]


def generate_migration(records: list[dict]) -> tuple[str, str]:
    """Return (up_sql, down_sql) strings."""

    # Index existing cities/ports for match-then-enrich.
    existing_cities_by_cc_name: dict[tuple[str, str], dict] = {}
    for c in ORIGINAL_CITIES:
        existing_cities_by_cc_name[(c["country_code"], norm_name(c["name"]))] = c

    existing_ports_by_city_name: dict[tuple[str, str], dict] = {}
    for p in ORIGINAL_PORTS:
        existing_ports_by_city_name[(p["city_id"], norm_name(p["name"]))] = p

    up: list[str] = []
    up.append("-- Locations V1: marina expansion")
    up.append("-- Generated by scripts/marina-extraction/4_generate_migration.py")
    up.append("-- ODbL: © OpenStreetMap contributors")
    up.append("")
    up.append("begin;")
    up.append("")

    # ------------------- Regions (by country) -------------------
    countries_in_csv = sorted({r["country_code"].upper() for r in records})
    # Also include every country present in ORIGINAL_CITIES so split Caribbean etc. get regenerated.
    extra_from_cities = sorted({c["country_code"] for c in ORIGINAL_CITIES})
    all_countries = sorted(set(countries_in_csv) | set(extra_from_cities))

    # Country name lookup: prefer COUNTRY_NAME_BY_CODE, fallback to first CSV row for the country.
    country_name_from_csv: dict[str, str] = {}
    for r in records:
        cc = r["country_code"].upper()
        if cc not in country_name_from_csv:
            country_name_from_csv[cc] = r["country"]

    def country_name(cc: str) -> str:
        return COUNTRY_NAME_BY_CODE.get(cc) or country_name_from_csv.get(cc) or cc

    up.append("-- ============================================================")
    up.append("-- Step 1: Insert/upsert region rows (deterministic UUIDv5 by country_code)")
    up.append("-- ============================================================")
    up.append("")
    for sort_order, cc in alphabetical_sort(all_countries, key=lambda x: country_name(x)):
        rid = region_uuid(cc)
        name = country_name(cc)
        up.append(
            f"insert into public.regions (id, name, country_code, sort_order) values "
            f"({sql_quote(rid)}, {sql_quote(name)}, {sql_quote(cc)}, {sort_order}) "
            f"on conflict (id) do update set name = excluded.name, country_code = excluded.country_code;"
        )
    up.append("")

    # ------------------- Re-parent existing cities -------------------
    up.append("-- ============================================================")
    up.append("-- Step 2: Re-parent existing cities to their new country regions")
    up.append("-- ============================================================")
    up.append("")
    for c in ORIGINAL_CITIES:
        new_rid = region_uuid(c["country_code"])
        up.append(
            f"update public.cities set region_id = {sql_quote(new_rid)} where id = {sql_quote(c['id'])};"
        )
    up.append("")

    # ------------------- Delete orphaned original region UUIDs -------------------
    up.append("-- ============================================================")
    up.append("-- Step 3: Delete the 7 original launch region rows (orphaned)")
    up.append("-- ============================================================")
    up.append("")
    for r in ORIGINAL_REGIONS:
        up.append(f"delete from public.regions where id = {sql_quote(r['id'])};")
    up.append("")

    # ------------------- Cities: match-or-insert -------------------
    up.append("-- ============================================================")
    up.append("-- Step 4: Match-or-insert cities (existing UUIDs preserved)")
    up.append("-- ============================================================")
    up.append("")

    by_country = build_country_membership(records)
    city_id_for_port_insert: dict[tuple[str, str], str] = {}
    # Track cities we've emitted already so we don't double-insert for the same town.
    cities_emitted: set[str] = set()

    for cc in sorted(by_country.keys()):
        towns_for_country = sorted({r["town"] for r in by_country[cc]})
        for sort_order, town in alphabetical_sort(towns_for_country, key=str.lower):
            key = (cc, norm_name(town))
            existing = existing_cities_by_cc_name.get(key)
            if existing:
                # Preserve existing UUID; region_id already updated in Step 2.
                cid = existing["id"]
            else:
                cid = city_uuid(cc, town)
                if cid in cities_emitted:
                    continue
                cities_emitted.add(cid)
                rid = region_uuid(cc)
                up.append(
                    f"insert into public.cities (id, region_id, name, sort_order) values "
                    f"({sql_quote(cid)}, {sql_quote(rid)}, {sql_quote(town)}, {sort_order}) "
                    f"on conflict (id) do nothing;"
                )
            city_id_for_port_insert[key] = cid
    up.append("")

    # ------------------- Ports: match-and-enrich or insert -------------------
    up.append("-- ============================================================")
    up.append("-- Step 5: Match-and-enrich or insert ports (existing UUIDs preserved)")
    up.append("-- ============================================================")
    up.append("")

    # Group by (cc, town) for per-city alphabetical sort_order on new ports
    ports_by_city_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in records:
        ports_by_city_key[(r["country_code"].upper(), norm_name(r["town"]))].append(r)

    for key in sorted(ports_by_city_key.keys()):
        cid = city_id_for_port_insert.get(key)
        if cid is None:
            continue  # defensive; shouldn't happen

        # Split existing vs new so sort_order within new rows starts above existing ones.
        port_entries = ports_by_city_key[key]

        enrich_entries: list[dict] = []
        new_entries: list[dict] = []
        for r in port_entries:
            match_key = (cid, norm_name(r["name"]))
            if match_key in existing_ports_by_city_name:
                enrich_entries.append((existing_ports_by_city_name[match_key], r))
            else:
                new_entries.append(r)

        # Enrich existing
        for existing, r in enrich_entries:
            up.append(
                f"update public.ports set latitude = {sql_num(r['lat'])}, "
                f"longitude = {sql_num(r['lon'])}, "
                f"osm_type = {sql_quote(r['osm_type'])}, "
                f"osm_id = {sql_num(r['osm_id'])}, "
                f"website = {sql_quote(r['website'])}, "
                f"phone = {sql_quote(r['phone'])}, "
                f"capacity = {sql_quote(r['capacity'])}, "
                f"vhf = {sql_quote(r['vhf'])} "
                f"where id = {sql_quote(existing['id'])};"
            )

        # Insert new with alphabetical sort_order
        for sort_order, r in alphabetical_sort(new_entries, key=lambda x: x["name"].lower()):
            pid = port_uuid(r["country_code"].upper(), r["town"], r["name"])
            up.append(
                f"insert into public.ports (id, city_id, name, sort_order, latitude, longitude, osm_type, osm_id, website, phone, capacity, vhf) values "
                f"({sql_quote(pid)}, {sql_quote(cid)}, {sql_quote(r['name'])}, {sort_order}, "
                f"{sql_num(r['lat'])}, {sql_num(r['lon'])}, {sql_quote(r['osm_type'])}, {sql_num(r['osm_id'])}, "
                f"{sql_quote(r['website'])}, {sql_quote(r['phone'])}, {sql_quote(r['capacity'])}, {sql_quote(r['vhf'])}) "
                f"on conflict (id) do nothing;"
            )

    up.append("")
    up.append("commit;")
    up.append("")

    # ------------------- Down SQL -------------------
    down: list[str] = []
    down.append("-- Rollback for locations V1 marina expansion")
    down.append("")
    down.append("begin;")
    down.append("")

    original_port_ids = {p["id"] for p in ORIGINAL_PORTS}
    original_city_ids = {c["id"] for c in ORIGINAL_CITIES}
    original_region_ids = {r["id"] for r in ORIGINAL_REGIONS}

    # 1. Delete new ports.
    down.append("-- Step 1: delete all non-original ports")
    down.append(
        "delete from public.ports where id not in ("
        + ", ".join(sql_quote(pid) for pid in sorted(original_port_ids))
        + ");"
    )
    down.append("")

    # 2. Delete new cities.
    down.append("-- Step 2: delete all non-original cities")
    down.append(
        "delete from public.cities where id not in ("
        + ", ".join(sql_quote(cid) for cid in sorted(original_city_ids))
        + ");"
    )
    down.append("")

    # 3. Restore original regions FIRST (by id + name + sort_order) so FKs from cities resolve.
    down.append("-- Step 3: reinsert original 7 launch regions with their legacy UUIDs")
    for r in ORIGINAL_REGIONS:
        down.append(
            f"insert into public.regions (id, name, sort_order) values "
            f"({sql_quote(r['id'])}, {sql_quote(r['name'])}, {r['sort_order']}) "
            f"on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;"
        )
    down.append("")

    # 4. Restore cities to original region_id.
    down.append("-- Step 4: restore original city.region_id + name + sort_order")
    for c in ORIGINAL_CITIES:
        down.append(
            f"update public.cities set region_id = {sql_quote(c['region_id'])}, "
            f"name = {sql_quote(c['name'])}, sort_order = {c['sort_order']} "
            f"where id = {sql_quote(c['id'])};"
        )
    down.append("")

    # 5. Delete any remaining region rows not in original set (UUIDv5 regenerations).
    down.append("-- Step 5: delete regenerated (UUIDv5) region rows")
    down.append(
        "delete from public.regions where id not in ("
        + ", ".join(sql_quote(rid) for rid in sorted(original_region_ids))
        + ");"
    )
    down.append("")

    # 6. Restore original port names + sort_order; null out OSM-derived columns.
    down.append("-- Step 6: restore original port names/sort_order and clear OSM enrichment")
    for p in ORIGINAL_PORTS:
        down.append(
            f"update public.ports set city_id = {sql_quote(p['city_id'])}, "
            f"name = {sql_quote(p['name'])}, sort_order = {p['sort_order']}, "
            f"latitude = null, longitude = null, osm_type = null, osm_id = null, "
            f"website = null, phone = null, capacity = null, vhf = null "
            f"where id = {sql_quote(p['id'])};"
        )
    down.append("")

    down.append("commit;")
    down.append("")

    return "\n".join(up), "\n".join(down)


# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------


def main() -> int:
    if not CSV_IN.exists():
        print(f"Missing {CSV_IN} - run Stage 3 first", file=sys.stderr)
        return 2

    MIGRATION_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading CSV...")
    records: list[dict] = []
    with CSV_IN.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({
                "country_code": (row["country_code"] or "").upper(),
                "country": row["country"],
                "town": row["town"],
                "name": row["name"],
                "lat": float(row["lat"]) if row["lat"] else None,
                "lon": float(row["lon"]) if row["lon"] else None,
                "osm_type": row["osm_type"] or None,
                "osm_id": int(row["osm_id"]) if row["osm_id"] else None,
                "website": row["website"] or None,
                "phone": row["phone"] or None,
                "capacity": row["capacity"] or None,
                "vhf": row["vhf"] or None,
            })
    print(f"  loaded {len(records)} records")

    print("Checking live DB baseline (optional)...")
    live = dump_live_state()
    validate_baseline(live)

    print("Generating migration SQL...")
    up_sql, down_sql = generate_migration(records)

    num = next_migration_number()
    up_path = MIGRATION_DIR / f"{num}_marinas_v1_expansion.sql"
    down_path = MIGRATION_DIR / f"{num}_marinas_v1_expansion.down.sql"
    up_path.write_text(up_sql, encoding="utf-8")
    down_path.write_text(down_sql, encoding="utf-8")

    print("")
    print(f"OK   {up_path}")
    print(f"OK   {down_path}")
    print("")
    print("Next steps:")
    print(f"  1. Review the SQL in {up_path}")
    print(f"  2. Copy to supabase/migrations/{num}_marinas_v1_expansion.sql")
    print(f"  3. Copy to supabase/rollbacks/{num}_marinas_v1_expansion.down.sql")
    print(f"  4. Run: npx supabase db push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
