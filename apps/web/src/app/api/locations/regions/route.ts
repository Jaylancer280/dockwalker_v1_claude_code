import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';

export interface RegionListItem {
  id: string;
  name: string;
  country_code: string | null;
}

/**
 * GET /api/locations/regions
 *
 * Returns every region (country) in the canonical table, ordered by
 * sort_order then name. Used by the manual "Request this location"
 * modal to populate its country picker.
 */
export async function GET() {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { supabase } = guard.value;

  try {
    const { data, error } = await supabase
      .from('regions')
      .select('id, name, country_code')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ regions: (data ?? []) as RegionListItem[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Region list lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
