import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

export interface LocationByIdResult {
  id: string;
  kind: 'port' | 'city';
  name: string;
  city_id: string | null;
  city_name: string | null;
  region_id: string | null;
  region_name: string | null;
  country_code: string | null;
}

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}

/**
 * GET /api/locations/by-ids?ports=<uuid>,<uuid>&cities=<uuid>,<uuid>
 *
 * Batch label resolver: given port and/or city UUIDs, return their full
 * display labels (name, city_name, region_name, country_code) in a single
 * round-trip. Used by LocationPicker to render a pre-existing value when
 * the picker hasn't been opened yet.
 *
 * Invalid UUIDs are silently filtered. Empty input returns an empty list.
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { supabase } = guard.value;

  try {
    const url = new URL(request.url);
    const portIds = parseIds(url.searchParams.get('ports'));
    const cityIds = parseIds(url.searchParams.get('cities'));

    if (portIds.length === 0 && cityIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const { data, error } = await supabase.rpc('get_locations_by_ids', {
      port_ids: portIds,
      city_ids: cityIds,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: (data ?? []) as LocationByIdResult[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Location lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
