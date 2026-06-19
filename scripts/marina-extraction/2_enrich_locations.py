"""Stage 2 — Resolve country/town for every marina.

Strategy: OSM address tags first, Nominatim reverse-geocoding fallback.
Nominatim respects the 1 req/sec rate limit. Cache every response to disk
(flushed every 50 records) so re-runs are fast.

Reads  data/marinas_raw.json
Writes data/marinas_enriched.json
Cache  data/nominatim_cache.json

Non-Latin names are accepted (Greek, Japanese, Arabic — accept-language=en
gives us the English country but does not force a Latin marina name).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"
RAW_IN = DATA_DIR / "marinas_raw.json"
ENRICHED_OUT = DATA_DIR / "marinas_enriched.json"
CACHE_PATH = DATA_DIR / "nominatim_cache.json"

USER_AGENT = "DockWalker-MarinaExtract/1.0 (gareth@nautalink.io)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_SLEEP = 1.0  # non-negotiable
TOWN_PRIORITY = ("city", "town", "village", "municipality", "county", "suburb")


def load_cache() -> dict[str, dict]:
    if CACHE_PATH.exists():
        with CACHE_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache: dict[str, dict]) -> None:
    with CACHE_PATH.open("w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)


def coords(el: dict) -> tuple[float, float] | None:
    if el.get("type") == "node":
        if "lat" in el and "lon" in el:
            return float(el["lat"]), float(el["lon"])
        return None
    center = el.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def pick_name(tags: dict) -> str | None:
    for key in ("name", "name:en", "name:int", "official_name", "alt_name"):
        v = tags.get(key)
        if v and str(v).strip():
            return str(v).strip()
    return None


def pick_town_from_address(addr: dict) -> str | None:
    for field in TOWN_PRIORITY:
        v = addr.get(field)
        if v and str(v).strip():
            return str(v).strip()
    return None


def pick_town_from_tags(tags: dict) -> str | None:
    for prefix in ("addr:city", "addr:town", "addr:village", "addr:municipality", "addr:suburb"):
        v = tags.get(prefix)
        if v and str(v).strip():
            return str(v).strip()
    return None


def normalise_website(v: str | None) -> str | None:
    if not v:
        return None
    v = v.strip()
    if not v:
        return None
    if v.startswith(("http://", "https://")):
        return v
    return f"https://{v}"


def enrich_fields(tags: dict) -> dict:
    return {
        "website": normalise_website(tags.get("website") or tags.get("contact:website")),
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "capacity": tags.get("capacity"),
        "vhf": tags.get("vhf") or tags.get("seamark:harbour:channel"),
    }


def reverse_geocode(lat: float, lon: float, cache: dict) -> dict | None:
    key = f"{round(lat, 4)},{round(lon, 4)}"
    if key in cache:
        return cache[key]
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "zoom": 12,
                "addressdetails": 1,
                "accept-language": "en",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        time.sleep(NOMINATIM_SLEEP)
        if resp.status_code != 200:
            cache[key] = {}
            return {}
        data = resp.json()
        cache[key] = data
        return data
    except Exception as e:
        print(f"  ! reverse geocode failed for {key}: {e}", file=sys.stderr)
        time.sleep(NOMINATIM_SLEEP)
        cache[key] = {}
        return {}


def main() -> int:
    if not RAW_IN.exists():
        print(f"Missing {RAW_IN} - run Stage 1 first", file=sys.stderr)
        return 2

    with RAW_IN.open("r", encoding="utf-8") as f:
        data = json.load(f)
    elements = data.get("elements", [])
    print(f"Loaded {len(elements)} raw marinas")

    cache = load_cache()
    enriched: list[dict] = []
    skipped_no_coord = 0
    skipped_no_name = 0
    skipped_no_country = 0

    for idx, el in enumerate(elements, start=1):
        tags = el.get("tags", {}) or {}
        pt = coords(el)
        if pt is None:
            skipped_no_coord += 1
            continue
        lat, lon = pt
        name = pick_name(tags)
        if not name:
            skipped_no_name += 1
            continue

        country = tags.get("addr:country")
        country_code = None
        town = pick_town_from_tags(tags)

        # If tags don't have everything, reverse geocode.
        if not (country and town):
            geo = reverse_geocode(lat, lon, cache) or {}
            addr = geo.get("address") or {}
            if not country:
                country = addr.get("country")
            if not country_code:
                cc = addr.get("country_code")
                country_code = cc.upper() if cc else None
            if not town:
                town = pick_town_from_address(addr)

        if not country or not country_code or not town:
            skipped_no_country += 1
            continue

        rec = {
            "osm_type": el.get("type"),
            "osm_id": el.get("id"),
            "name": name,
            "country": country,
            "country_code": country_code,
            "town": town,
            "lat": lat,
            "lon": lon,
            **enrich_fields(tags),
            "raw_tags": tags,
        }
        enriched.append(rec)

        if idx % 50 == 0:
            save_cache(cache)
            print(f"  {idx}/{len(elements)} processed ({len(enriched)} kept)")

    save_cache(cache)

    with ENRICHED_OUT.open("w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print("")
    print(f"OK   Wrote {len(enriched)} enriched records -> {ENRICHED_OUT}")
    print(f"  skipped: {skipped_no_coord} no coord, {skipped_no_name} no name, {skipped_no_country} no country")
    return 0


if __name__ == "__main__":
    sys.exit(main())
