import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/daywork/discover?sort=recency|proximity|tenure&roleId=&portId=
 * Returns active daywork postings for crew discovery.
 * Excludes jobs the crew has already applied to, been superseded on, or where they lack availability.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: person } = await supabase
    .from('persons')
    .select('current_hat')
    .eq('id', user.id)
    .single();

  if (!person || person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can discover jobs' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') ?? 'recency';
  const filterRoleId = searchParams.get('roleId');
  const filterPortId = searchParams.get('portId');

  // Get IDs of dayworks this crew has already interacted with
  const { data: existingApps } = await supabase
    .from('applications')
    .select('daywork_id')
    .eq('crew_person_id', user.id)
    .in('status', ['applied', 'viewed', 'accepted', 'superseded', 'withdrawn']);

  const excludedIds = (existingApps ?? []).map((a) => a.daywork_id);

  // Get crew's available dates (non-expired)
  const { data: availWindows } = await supabase
    .from('availability_windows')
    .select('date')
    .eq('person_id', user.id)
    .gt('expires_at', new Date().toISOString());

  const availDates = new Set((availWindows ?? []).map((w) => w.date));

  // Build query for active dayworks
  let query = supabase
    .from('dayworks')
    .select(
      `
      id, start_date, end_date, working_days, day_rate, meals, notes, status, created_at,
      poster_person_id,
      yacht_roles(id, name, department),
      ports(id, name, cities(name, regions(name))),
      vessels(name, nda_flag, vessel_type, vessel_size_bands(label)),
      experience_brackets(label),
      required_certification_ids
    `,
    )
    .eq('status', 'active');

  // Exclude already-applied jobs
  if (excludedIds.length > 0) {
    // Supabase doesn't have a "not in" with array easily, so we filter client-side
  }

  // Apply filters
  if (filterRoleId) {
    query = query.eq('role_id', filterRoleId);
  }
  if (filterPortId) {
    query = query.eq('location_port_id', filterPortId);
  }

  // Sort
  if (sort === 'recency') {
    query = query.order('created_at', { ascending: false });
  } else {
    // Default to recency — proximity and tenure sorting done client-side
    // since they require crew profile data to compare against
    query = query.order('created_at', { ascending: false });
  }

  const { data: dayworks, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Client-side filtering
  const filtered = (dayworks ?? []).filter((dw) => {
    // Exclude already interacted
    if (excludedIds.includes(dw.id)) return false;

    // Don't show own postings
    if (dw.poster_person_id === user.id) return false;

    // Check availability overlap: crew must have at least one available day
    // within the daywork date range
    if (availDates.size > 0) {
      const start = new Date(dw.start_date);
      const end = new Date(dw.end_date);
      let hasOverlap = false;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (availDates.has(d.toISOString().split('T')[0])) {
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) return false;
    }

    return true;
  });

  return NextResponse.json({ dayworks: filtered });
}
