"""Stage 1 — Pull raw marina data from OpenStreetMap via Overpass.

Chunks by regional bounding box, rotates Overpass mirrors on failure, resumable
(skips regions whose JSON file already exists). Writes per-region JSON to
data/regions/, then merges into data/marinas_raw.json with (osm_type, osm_id)
dedup.

Usage:
    python 1_extract_marinas.py                      # all regions
    python 1_extract_marinas.py --regions europe_west,mediterranean_east
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"
REGIONS_DIR = DATA_DIR / "regions"
RAW_OUT = DATA_DIR / "marinas_raw.json"

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

USER_AGENT = "DockWalker-MarinaExtract/1.0 (gareth@nautalink.io)"

# (south, west, north, east)
REGIONS: dict[str, tuple[float, float, float, float]] = {
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
    "east_asia":          (18.0,  98.0, 54.0, 125.0),
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

OVERPASS_QUERY_TEMPLATE = """
[out:json][timeout:180];
(
  node["leisure"="marina"]({south},{west},{north},{east});
  way["leisure"="marina"]({south},{west},{north},{east});
  relation["leisure"="marina"]({south},{west},{north},{east});
);
out center tags;
"""


def fetch_region(name: str, bbox: tuple[float, float, float, float]) -> dict | None:
    south, west, north, east = bbox
    query = OVERPASS_QUERY_TEMPLATE.format(south=south, west=west, north=north, east=east)
    for attempt in range(1, 7):
        mirror = OVERPASS_MIRRORS[(attempt - 1) % len(OVERPASS_MIRRORS)]
        try:
            print(f"  attempt {attempt}/6 -> {mirror}")
            resp = requests.post(
                mirror,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=240,
            )
            if resp.status_code == 200:
                data = resp.json()
                count = len(data.get("elements", []))
                print(f"  OK   {name}: {count} elements")
                return data
            if resp.status_code in (429, 504):
                wait = 30 * attempt
                print(f"  !    {resp.status_code} - sleeping {wait}s")
                time.sleep(wait)
                continue
            print(f"  !    status {resp.status_code}")
            time.sleep(15 * attempt)
        except Exception as e:
            print(f"  !    {type(e).__name__}: {e}")
            time.sleep(15 * attempt)
    print(f"  FAIL {name}: giving up after 6 attempts")
    return None


def merge_all_regions() -> None:
    seen: set[tuple[str, int]] = set()
    merged: list[dict] = []
    for region_file in sorted(REGIONS_DIR.glob("*.json")):
        with region_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
        for el in data.get("elements", []):
            key = (el.get("type", ""), el.get("id", 0))
            if key in seen:
                continue
            seen.add(key)
            merged.append(el)
    with RAW_OUT.open("w", encoding="utf-8") as f:
        json.dump({"elements": merged}, f, ensure_ascii=False, indent=2)
    print(f"\nOK   Merged {len(merged)} unique marinas -> {RAW_OUT}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--regions", help="Comma-separated region names to run (default: all)")
    args = parser.parse_args()

    REGIONS_DIR.mkdir(parents=True, exist_ok=True)

    selected = set(REGIONS.keys())
    if args.regions:
        requested = {r.strip() for r in args.regions.split(",")}
        unknown = requested - set(REGIONS.keys())
        if unknown:
            print(f"Unknown regions: {sorted(unknown)}", file=sys.stderr)
            return 2
        selected = requested

    for name in sorted(selected):
        out_path = REGIONS_DIR / f"{name}.json"
        if out_path.exists():
            print(f"[skip] {name} - already downloaded")
            continue
        print(f"[fetch] {name}")
        data = fetch_region(name, REGIONS[name])
        if data is None:
            continue
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        time.sleep(2)

    merge_all_regions()
    return 0


if __name__ == "__main__":
    sys.exit(main())
