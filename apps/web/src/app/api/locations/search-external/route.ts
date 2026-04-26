import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';

export interface ExternalLocationResult {
  osm_id: number;
  osm_type: 'node' | 'way' | 'relation';
  name: string;
  country_code: string | null;
  country_name: string | null;
  latitude: number;
  longitude: number;
  place_type: 'city' | 'town' | 'village' | 'harbour' | 'port' | 'marina';
  display_name: string;
}

interface NominatimResult {
  osm_id: number;
  osm_type: 'node' | 'way' | 'relation';
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  name?: string;
  address?: {
    country_code?: string;
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'dockwalker.io/1.0 (gareth@nautalink.io)';
const RESULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 3;
const REQUEST_TIMEOUT_MS = 4000;

// Best-effort 1-req/sec global rate limit per Vercel function instance to
// honour Nominatim's usage policy. Multiple instances may exceed this in
// aggregate; we accept that — getting close to 1 req/sec/instance is enough
// for a small launch. If rate-limited locally we return [] without blocking.
const MIN_REQUEST_INTERVAL_MS = 1000;
let lastRequestAt = 0;

function placeTypeOf(r: NominatimResult): ExternalLocationResult['place_type'] | null {
  if (r.class === 'place') {
    if (r.type === 'city' || r.type === 'town' || r.type === 'village') return r.type;
  }
  if (r.class === 'leisure' && r.type === 'marina') return 'marina';
  if (r.class === 'amenity' && r.type === 'ferry_terminal') return 'port';
  if (r.class === 'harbour' || r.type === 'harbour') return 'harbour';
  return null;
}

function normalize(r: NominatimResult): ExternalLocationResult | null {
  const place_type = placeTypeOf(r);
  if (!place_type) return null;

  const lat = Number(r.lat);
  const lon = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Prefer the result's own name; fall back to the first comma-segment of
  // display_name (Nominatim uses that as the canonical short label).
  const name = (r.name ?? r.display_name?.split(',')[0] ?? '').trim();
  if (!name) return null;

  const cc = r.address?.country_code?.toUpperCase() ?? null;
  const country_name = r.address?.country ?? null;

  return {
    osm_id: r.osm_id,
    osm_type: r.osm_type,
    name,
    country_code: cc && /^[A-Z]{2}$/.test(cc) ? cc : null,
    country_name,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    place_type,
    display_name: r.display_name ?? name,
  };
}

/**
 * GET /api/locations/search-external?q=<needle>
 *
 * Live OSM Nominatim fallback for the canonical-search empty state. Fired
 * by `LocationPicker` only after `/api/locations/search` returns zero hits
 * AND the query is ≥3 chars. Results are normalized to the same shape the
 * canonicalize route accepts, so the picker can hand the user's selection
 * straight back into a POST without further translation.
 *
 * Errors are swallowed to an empty result set — never block the user.
 */
export async function GET(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  // In-memory rate limit. If a request lands inside the cooldown window,
  // return empty results immediately rather than queue (queueing in a
  // serverless function adds latency for no real upside).
  const now = Date.now();
  if (now - lastRequestAt < MIN_REQUEST_INTERVAL_MS) {
    return NextResponse.json({ results: [] });
  }
  lastRequestAt = now;

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: String(RESULT_LIMIT),
    'accept-language': 'en',
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let raw: NominatimResult[] = [];
    try {
      const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const body = (await res.json()) as unknown;
        if (Array.isArray(body)) raw = body as NominatimResult[];
      }
    } finally {
      clearTimeout(timer);
    }

    const results = raw.map(normalize).filter((r): r is ExternalLocationResult => r !== null);
    return NextResponse.json({ results });
  } catch {
    // Network error, timeout, JSON parse failure — treat as no results.
    return NextResponse.json({ results: [] });
  }
}
