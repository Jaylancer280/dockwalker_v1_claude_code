import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

export interface LocationSearchResult {
  id: string;
  kind: 'region' | 'city' | 'port';
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  country_code: string | null;
  score: number;
}

/**
 * GET /api/locations/search?q=<needle>
 *
 * Fuzzy full-text search across regions, cities, and ports via the
 * `search_locations` RPC (pg_trgm + unaccent). Diacritic-insensitive —
 * "gocek" matches "Göcek". Requires at least 2 characters.
 *
 * Returns up to 50 matches ordered by trigram similarity (best first).
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { supabase } = guard.value;

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const { data, error } = await supabase.rpc('search_locations', { q });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: (data ?? []) as LocationSearchResult[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Location search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
