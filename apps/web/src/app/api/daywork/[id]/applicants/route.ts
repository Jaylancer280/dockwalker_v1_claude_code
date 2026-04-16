import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/:id/applicants
 * Returns applicants for a daywork posting. Employer/agent only (must own the posting).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  const url = new URL(request.url);
  const filterCertificationId = url.searchParams.get('certificationId');
  const filterMinAvailableDays = url.searchParams.get('minAvailableDays');
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase, serviceClient } = guard.value;

    // Verify user owns this daywork posting
    const { data: daywork } = await supabase
      .from('dayworks')
      .select(
        'id, poster_person_id, start_date, end_date, positions_available, positions_filled, permanent_opportunity',
      )
      .eq('id', dayworkId)
      .single();

    if (!daywork) {
      return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
    }

    if (daywork.poster_person_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
    }

    // Get applications with crew profile data
    // Use serviceClient: ownership is already verified above, RLS subquery on
    // dayworks can silently filter applications for agent-hat posters.
    const { data: applications, error } = await serviceClient
      .from('applications')
      .select(
        `
      id, crew_person_id, status, message, created_at, source,
      profiles!applications_crew_person_id_profiles_fkey(
        display_name, avatar_url, deck_name,
        primary_role_id,
        certification_ids,
        languages,
        experience_bracket_id,
        vessel_size_exposure_ids,
        bio,
        location_port_id,
        smoker, visible_tattoos,
        yacht_roles:primary_role_id(name, department),
        experience_brackets:experience_bracket_id(label),
        ports:location_port_id(name, cities(name, regions(name))),
        nationalities:nationality_id(name, flag_emoji)
      )
    `,
      )
      .eq('daywork_id', dayworkId)
      .in('status', ['applied', 'viewed', 'shortlisted'])
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const crewIds = (applications ?? []).map((a) => a.crew_person_id);

    const availabilityMap: Record<string, number> = {};
    const availabilityCityMap: Record<string, string> = {};
    const notAvailableSet = new Set<string>();
    const engagementCountMap: Record<string, number> = {};
    const shoreCategoryMap: Record<string, string[]> = {};

    if (crewIds.length > 0) {
      const [availResult, engResult, shoreResult] = await Promise.all([
        serviceClient
          .from('availability_windows')
          .select('person_id, date, city_id, not_available')
          .in('person_id', crewIds)
          .gt('expires_at', new Date().toISOString()),
        serviceClient
          .from('active_engagements')
          .select('crew_person_id')
          .in('crew_person_id', crewIds)
          .eq('status', 'completed'),
        serviceClient
          .from('shore_experiences')
          .select('person_id, shore_experience_categories(name)')
          .in('person_id', crewIds),
      ]);

      const availWindows = availResult.data ?? [];
      const cityIds = new Set<string>();
      for (const w of availWindows) {
        if (w.not_available) {
          notAvailableSet.add(w.person_id);
          if (w.city_id) cityIds.add(w.city_id);
          continue;
        }
        if (w.date >= daywork.start_date && w.date <= daywork.end_date) {
          availabilityMap[w.person_id] = (availabilityMap[w.person_id] ?? 0) + 1;
        }
        if (w.city_id) cityIds.add(w.city_id);
      }

      if (cityIds.size > 0) {
        const { data: cities } = await serviceClient
          .from('cities')
          .select('id, name, regions(name)')
          .in('id', [...cityIds]);

        const cityNameMap = new Map<string, string>();
        for (const c of cities ?? []) {
          const regions = c.regions as unknown as { name: string } | null;
          cityNameMap.set(c.id, `${c.name}, ${regions?.name ?? ''}`);
        }

        for (const w of availWindows) {
          if (w.city_id && !availabilityCityMap[w.person_id]) {
            availabilityCityMap[w.person_id] = cityNameMap.get(w.city_id) ?? '';
          }
        }
      }

      for (const e of engResult.data ?? []) {
        engagementCountMap[e.crew_person_id] = (engagementCountMap[e.crew_person_id] ?? 0) + 1;
      }

      for (const se of shoreResult.data ?? []) {
        const cat = se.shore_experience_categories as unknown as { name: string } | null;
        if (cat?.name) {
          if (!shoreCategoryMap[se.person_id]) shoreCategoryMap[se.person_id] = [];
          if (!shoreCategoryMap[se.person_id].includes(cat.name)) {
            shoreCategoryMap[se.person_id].push(cat.name);
          }
        }
      }
    }

    let enriched = (applications ?? []).map((app) => ({
      ...app,
      available_days: availabilityMap[app.crew_person_id] ?? 0,
      availability_city: availabilityCityMap[app.crew_person_id] ?? null,
      availability_not_available: notAvailableSet.has(app.crew_person_id),
      past_daywork_count: engagementCountMap[app.crew_person_id] ?? 0,
      shore_experience_categories: shoreCategoryMap[app.crew_person_id] ?? [],
    }));

    // Post-enrichment filters
    if (filterCertificationId) {
      enriched = enriched.filter((a) => {
        const profile = a.profiles as unknown as { certification_ids: string[] } | null;
        return profile?.certification_ids?.includes(filterCertificationId) ?? false;
      });
    }
    if (filterMinAvailableDays) {
      const parsed = parseInt(filterMinAvailableDays, 10);
      if (!isNaN(parsed)) {
        const minDays = Math.max(0, Math.min(parsed, 365));
        enriched = enriched.filter((a) => a.available_days >= minDays);
      }
    }

    return NextResponse.json({
      applicants: enriched,
      positions_available: daywork.positions_available,
      positions_filled: daywork.positions_filled,
      positions_remaining: daywork.positions_available - daywork.positions_filled,
      permanent_opportunity: daywork.permanent_opportunity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
