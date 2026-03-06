import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/daywork/mine
 * Returns the authenticated user's daywork postings with related data.
 * Optional query param: ?status=active or ?status=completed,cancelled
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('dayworks')
    .select(
      `
      id, role_context, start_date, end_date, working_days,
      day_rate, meals, notes, status, created_at,
      yacht_roles(name),
      ports(name, cities(name, regions(name))),
      vessels(name, nda_flag, vessel_size_bands(label)),
      experience_brackets(label)
    `,
    )
    .eq('poster_person_id', user.id)
    .order('created_at', { ascending: false });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s) => s.trim());
    query = query.in('status', statuses);
  }

  const { data: dayworks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dayworks: dayworks ?? [] });
}
