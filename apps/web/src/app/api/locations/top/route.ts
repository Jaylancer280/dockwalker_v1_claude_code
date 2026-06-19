import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';

export interface TopLocationResult {
  id: string;
  name: string;
  city_id: string | null;
  city_name: string | null;
  region_id: string | null;
  region_name: string | null;
  country_code: string | null;
  usage_count: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/locations/top?limit=<n>
 *
 * Returns the top-N most-used ports (ranked by count of references across
 * profiles, dayworks, permanent_postings, then falling back to sort_order).
 * Used as the LocationPicker's empty-state list.
 */
export async function GET(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { supabase } = guard.value;

  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const { data, error } = await supabase.rpc('top_locations', { port_limit: limit });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: (data ?? []) as TopLocationResult[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Top locations lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
