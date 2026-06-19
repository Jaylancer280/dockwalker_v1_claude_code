import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';

interface CanonicalizeBody {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  country_code?: string;
  country_name?: string | null;
  latitude?: number;
  longitude?: number;
  place_type?: string;
}

const VALID_OSM_TYPES = new Set(['node', 'way', 'relation']);
const VALID_PLACE_TYPES = new Set(['city', 'town', 'village', 'harbour', 'port', 'marina']);
const OSM_FALLBACK_SORT_ORDER = 999;
const MAX_NAME_LENGTH = 200;

function osmPlaceIdFor(osm_type: string, osm_id: number): string {
  // Single short letter prefix matches OSM's own URL convention (N/W/R).
  const prefix = osm_type === 'node' ? 'N' : osm_type === 'way' ? 'W' : 'R';
  return `${prefix}${osm_id}`;
}

function isValidBody(
  body: unknown,
): body is Required<
  Pick<CanonicalizeBody, 'osm_id' | 'osm_type' | 'name' | 'latitude' | 'longitude' | 'place_type'>
> &
  CanonicalizeBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as CanonicalizeBody;
  if (typeof b.osm_id !== 'number' || !Number.isFinite(b.osm_id)) return false;
  if (typeof b.osm_type !== 'string' || !VALID_OSM_TYPES.has(b.osm_type)) return false;
  if (typeof b.name !== 'string' || b.name.trim().length === 0) return false;
  if (b.name.length > MAX_NAME_LENGTH) return false;
  if (typeof b.latitude !== 'number' || !Number.isFinite(b.latitude)) return false;
  if (typeof b.longitude !== 'number' || !Number.isFinite(b.longitude)) return false;
  if (b.latitude < -90 || b.latitude > 90) return false;
  if (b.longitude < -180 || b.longitude > 180) return false;
  if (typeof b.place_type !== 'string' || !VALID_PLACE_TYPES.has(b.place_type)) return false;
  if (b.country_code != null) {
    if (typeof b.country_code !== 'string') return false;
    if (!/^[A-Z]{2}$/.test(b.country_code)) return false;
  }
  if (b.country_name != null) {
    if (typeof b.country_name !== 'string') return false;
    if (b.country_name.length > MAX_NAME_LENGTH) return false;
  }
  return true;
}

/**
 * POST /api/locations/canonicalize
 *
 * Idempotent upsert from a Nominatim search hit into our canonical
 * `regions` + `cities` tables. The picker calls this when the user
 * accepts an OSM fallback result — the returned `cityId` is then used
 * exactly as if it had come from canonical search.
 *
 * Behaviour:
 *   1. Find or create the `regions` row by `country_code`. If we have
 *      no country code at all, fall back to a singleton "Unknown" region
 *      so the FK constraint is still satisfied.
 *   2. Look the city up first by `osm_place_id`, then by
 *      `(region_id, lower(name))`. Either match returns its id without
 *      mutating curated rows.
 *   3. If neither matches, INSERT a new city with `source='osm'` plus
 *      lat/lng + `osm_place_id`.
 *
 * v1 stores only cities — port/marina/harbour OSM hits collapse to a
 * city with the same name. This is enough for `port-optional` use
 * (most callsites). Admins can promote noteworthy entries to canonical
 * ports later via `/admin/canonical/ports`.
 */
export async function POST(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const cc = body.country_code ?? null;
  const countryName = body.country_name?.trim() || null;
  const osm_place_id = osmPlaceIdFor(body.osm_type, body.osm_id);
  const cityName = body.name.trim();

  try {
    // ── 1. Find or create region ──────────────────────────────────
    let regionId: string | null = null;

    if (cc) {
      const { data: existingRegion, error: regionLookupError } = await serviceClient
        .from('regions')
        .select('id')
        .eq('country_code', cc)
        .maybeSingle();
      if (regionLookupError) {
        return NextResponse.json({ error: regionLookupError.message }, { status: 500 });
      }
      if (existingRegion) {
        regionId = existingRegion.id;
      } else {
        const { data: newRegion, error: regionInsertError } = await serviceClient
          .from('regions')
          .insert({
            name: countryName ?? cc,
            country_code: cc,
            sort_order: OSM_FALLBACK_SORT_ORDER,
          })
          .select('id')
          .single();
        if (regionInsertError || !newRegion) {
          return NextResponse.json(
            { error: regionInsertError?.message ?? 'Region creation failed' },
            { status: 500 },
          );
        }
        regionId = newRegion.id;
      }
    } else {
      // No country code — use or create a singleton "Unknown" region.
      const { data: unknownRegion, error: unknownLookupError } = await serviceClient
        .from('regions')
        .select('id')
        .eq('name', 'Unknown')
        .is('country_code', null)
        .maybeSingle();
      if (unknownLookupError) {
        return NextResponse.json({ error: unknownLookupError.message }, { status: 500 });
      }
      if (unknownRegion) {
        regionId = unknownRegion.id;
      } else {
        const { data: newRegion, error: regionInsertError } = await serviceClient
          .from('regions')
          .insert({ name: 'Unknown', sort_order: OSM_FALLBACK_SORT_ORDER })
          .select('id')
          .single();
        if (regionInsertError || !newRegion) {
          return NextResponse.json(
            { error: regionInsertError?.message ?? 'Unknown region creation failed' },
            { status: 500 },
          );
        }
        regionId = newRegion.id;
      }
    }

    // ── 2. Find existing city by osm_place_id ─────────────────────
    const { data: byOsm, error: osmLookupError } = await serviceClient
      .from('cities')
      .select('id')
      .eq('osm_place_id', osm_place_id)
      .maybeSingle();
    if (osmLookupError) {
      return NextResponse.json({ error: osmLookupError.message }, { status: 500 });
    }
    if (byOsm) {
      return NextResponse.json({ cityId: byOsm.id });
    }

    // ── 3. Find existing city by (region_id, name) — case-insensitive ──
    const { data: byName, error: nameLookupError } = await serviceClient
      .from('cities')
      .select('id')
      .eq('region_id', regionId)
      .ilike('name', cityName)
      .maybeSingle();
    if (nameLookupError) {
      return NextResponse.json({ error: nameLookupError.message }, { status: 500 });
    }
    if (byName) {
      return NextResponse.json({ cityId: byName.id });
    }

    // ── 4. Insert new OSM-sourced city ────────────────────────────
    const { data: newCity, error: insertError } = await serviceClient
      .from('cities')
      .insert({
        region_id: regionId,
        name: cityName,
        source: 'osm',
        osm_place_id,
        latitude: body.latitude,
        longitude: body.longitude,
        sort_order: OSM_FALLBACK_SORT_ORDER,
      })
      .select('id')
      .single();

    if (insertError || !newCity) {
      // Race condition: another concurrent canonicalize for the same
      // osm_place_id could have inserted between our SELECTs and INSERT.
      // Re-query by osm_place_id and return that row if present.
      if (insertError?.code === '23505') {
        const { data: raceWinner } = await serviceClient
          .from('cities')
          .select('id')
          .eq('osm_place_id', osm_place_id)
          .maybeSingle();
        if (raceWinner) {
          return NextResponse.json({ cityId: raceWinner.id });
        }
      }
      return NextResponse.json(
        { error: insertError?.message ?? 'City insert failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ cityId: newCity.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Canonicalize failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
