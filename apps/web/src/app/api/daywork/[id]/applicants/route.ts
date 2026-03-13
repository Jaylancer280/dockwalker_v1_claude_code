import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/:id/applicants
 * Returns applicants for a daywork posting. Employer/agent only (must own the posting).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  // Verify user owns this daywork posting
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, start_date, end_date')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
  }

  // Get applications with crew profile data
  const { data: applications, error } = await supabase
    .from('applications')
    .select(
      `
      id, crew_person_id, status, message, created_at,
      profiles!applications_crew_person_id_profiles_fkey(
        display_name,
        primary_role_id,
        certification_ids,
        experience_bracket_id,
        vessel_size_exposure_ids,
        bio,
        location_port_id,
        yacht_roles:primary_role_id(name, department),
        experience_brackets:experience_bracket_id(label),
        ports:location_port_id(name, cities(name, regions(name)))
      )
    `,
    )
    .eq('daywork_id', dayworkId)
    .in('status', ['applied', 'viewed', 'shortlisted'])
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with availability overlap for the daywork dates
  const crewIds = (applications ?? []).map((a) => a.crew_person_id);

  const availabilityMap: Record<string, number> = {};
  const availabilityCityMap: Record<string, string> = {};
  const notAvailableSet = new Set<string>();
  if (crewIds.length > 0) {
    const { data: availWindows } = await supabase
      .from('availability_windows')
      .select('person_id, date, city_id, not_available')
      .in('person_id', crewIds)
      .gt('expires_at', new Date().toISOString());

    // Separate not-available markers from real availability
    const cityIds = new Set<string>();
    for (const w of availWindows ?? []) {
      if (w.not_available) {
        notAvailableSet.add(w.person_id);
        if (w.city_id) cityIds.add(w.city_id);
        continue;
      }
      // Only count windows within the daywork date range
      if (w.date >= daywork.start_date && w.date <= daywork.end_date) {
        availabilityMap[w.person_id] = (availabilityMap[w.person_id] ?? 0) + 1;
      }
      if (w.city_id) cityIds.add(w.city_id);
    }

    // Resolve city names
    if (cityIds.size > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, regions(name)')
        .in('id', [...cityIds]);

      const cityNameMap = new Map<string, string>();
      for (const c of cities ?? []) {
        const regions = c.regions as unknown as { name: string } | null;
        cityNameMap.set(c.id, `${c.name}, ${regions?.name ?? ''}`);
      }

      // Map first city_id per crew member
      for (const w of availWindows ?? []) {
        if (w.city_id && !availabilityCityMap[w.person_id]) {
          availabilityCityMap[w.person_id] = cityNameMap.get(w.city_id) ?? '';
        }
      }
    }
  }

  // Count past completed engagements per crew member
  const engagementCountMap: Record<string, number> = {};
  if (crewIds.length > 0) {
    const { data: pastEngagements } = await supabase
      .from('active_engagements')
      .select('crew_person_id')
      .in('crew_person_id', crewIds)
      .eq('status', 'completed');

    for (const e of pastEngagements ?? []) {
      engagementCountMap[e.crew_person_id] = (engagementCountMap[e.crew_person_id] ?? 0) + 1;
    }
  }

  const enriched = (applications ?? []).map((app) => ({
    ...app,
    available_days: availabilityMap[app.crew_person_id] ?? 0,
    availability_city: availabilityCityMap[app.crew_person_id] ?? null,
    availability_not_available: notAvailableSet.has(app.crew_person_id),
    past_daywork_count: engagementCountMap[app.crew_person_id] ?? 0,
  }));

  return NextResponse.json({ applicants: enriched });
}
