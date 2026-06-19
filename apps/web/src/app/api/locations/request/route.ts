import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';
import { notifyAdminsOfLocationRequest } from '@/lib/push-triggers/location-admin-notify';

interface RequestBody {
  country_code?: string;
  country_name?: string | null;
  city_name?: string;
  port_name?: string | null;
  notes?: string | null;
}

const REGION_FALLBACK_SORT_ORDER = 999;
const PENDING_SORT_ORDER = 999;
const MAX_NOTES_LENGTH = 500;
const MAX_NAME_LENGTH = 120;

function normaliseString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * POST /api/locations/request
 *
 * Manual "Request this location" submission — last-resort fallback when
 * canonical search AND OSM Nominatim live search both return zero hits.
 * The submitting user gets a real (pending) row inserted and immediately
 * sees their typed text on their profile because the FK resolves; the
 * rest of the user base never sees it because `search_locations` and
 * `top_locations` filter on `source IN ('curated', 'osm')`.
 *
 * Body: `{ country_code, country_name?, city_name, port_name?, notes? }`.
 * Returns: `{ cityId, portId? }` — both are stable UUIDs the picker can
 * hand straight back into its `onValueChange` callback.
 *
 * Wave D's admin queue then approves / merges / hides each pending row
 * via `/admin/locations/pending`.
 */
export async function POST(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;
  const submitterId = user.id;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const cc = normaliseString(body.country_code)?.toUpperCase() ?? null;
  if (!cc || !/^[A-Z]{2}$/.test(cc)) {
    return NextResponse.json(
      { error: 'country_code is required and must be a 2-letter ISO code' },
      { status: 400 },
    );
  }
  const countryName = normaliseString(body.country_name);

  const cityName = normaliseString(body.city_name);
  if (!cityName) {
    return NextResponse.json({ error: 'city_name is required' }, { status: 400 });
  }
  if (cityName.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `city_name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const portName = normaliseString(body.port_name);
  if (portName && portName.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `port_name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const notes = normaliseString(body.notes);
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json(
      { error: `notes must be ${MAX_NOTES_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  try {
    // ── 1. Find or create region by country_code ──────────────────
    let regionId: string | null = null;
    {
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
            sort_order: REGION_FALLBACK_SORT_ORDER,
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
    }

    // ── 2. Look the city up first; if it already exists (curated /
    //       osm / pending) reuse it and skip the pending insert. The
    //       picker treats the result the same way regardless of source.
    let cityId: string;
    {
      const { data: existingCity, error: cityLookupError } = await serviceClient
        .from('cities')
        .select('id')
        .eq('region_id', regionId)
        .ilike('name', cityName)
        .maybeSingle();
      if (cityLookupError) {
        return NextResponse.json({ error: cityLookupError.message }, { status: 500 });
      }
      if (existingCity) {
        cityId = existingCity.id;
      } else {
        const { data: newCity, error: cityInsertError } = await serviceClient
          .from('cities')
          .insert({
            region_id: regionId,
            name: cityName,
            source: 'pending',
            sort_order: PENDING_SORT_ORDER,
            submitted_by: submitterId,
          })
          .select('id')
          .single();
        if (cityInsertError || !newCity) {
          return NextResponse.json(
            { error: cityInsertError?.message ?? 'City insert failed' },
            { status: 500 },
          );
        }
        cityId = newCity.id;
      }
    }

    // ── 3. Optional port — same find-or-create logic. We do NOT
    //       check the port's existing source: if a curated port with
    //       that name already exists under the city, the user gets
    //       it for free.
    let portId: string | null = null;
    if (portName) {
      const { data: existingPort, error: portLookupError } = await serviceClient
        .from('ports')
        .select('id')
        .eq('city_id', cityId)
        .ilike('name', portName)
        .maybeSingle();
      if (portLookupError) {
        return NextResponse.json({ error: portLookupError.message }, { status: 500 });
      }
      if (existingPort) {
        portId = existingPort.id;
      } else {
        const { data: newPort, error: portInsertError } = await serviceClient
          .from('ports')
          .insert({
            city_id: cityId,
            name: portName,
            source: 'pending',
            sort_order: PENDING_SORT_ORDER,
            submitted_by: submitterId,
          })
          .select('id')
          .single();
        if (portInsertError || !newPort) {
          return NextResponse.json(
            { error: portInsertError?.message ?? 'Port insert failed' },
            { status: 500 },
          );
        }
        portId = newPort.id;
      }
    }

    // Best-effort: look up the submitter's display name and fan out an
    // admin notification. Failures here mustn't block the user response.
    try {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('display_name')
        .eq('person_id', submitterId)
        .maybeSingle();
      const submitterName = (profile?.display_name as string | undefined) ?? 'A user';
      await notifyAdminsOfLocationRequest(serviceClient, {
        submitterName,
        cityName,
        portName,
        countryName,
      });
    } catch {
      // Swallow — notification fan-out is fire-and-forget.
    }

    return NextResponse.json(portId !== null ? { cityId, portId } : { cityId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Location request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
