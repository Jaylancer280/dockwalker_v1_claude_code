import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { haversineKm, pointsCentroid } from '@dockwalker/shared';

/** Hard ceiling on the proximity match — beyond this kilometres the crew
 *  is dropped from the list regardless of region. Daywork is 1-14 day
 *  work; commuting much further than this stops being realistic. */
const MAX_DISTANCE_KM = 200;

/** Cap on the rendered list — the existing UI shows a swipe deck of
 *  candidates; 50 is plenty and keeps the post-fetch profile lookup cheap. */
const MAX_RESULTS = 50;

type DistanceBucket = 'same-port' | 'same-city' | 'same-region';

/**
 * GET /api/daywork/:id/available-crew
 *
 * Returns Pro crew with matching availability who haven't applied or
 * been invited. Employer/agent only (must own the posting).
 *
 * Match scope: same city OR same region (Locations V2 hierarchy). Within
 * the matched pool, candidates are ordered by haversine distance from
 * the daywork's port to the crew's anchor (their pinned availability
 * port, or the centroid of their city's ports). Distance is held
 * internal — only a same-port / same-city / same-region pill surfaces.
 *
 * Tiebreak chain: distance ASC → available_days DESC → most-recent
 * availability refresh DESC → person_id ASC (stable). Hard 200km
 * ceiling. When the daywork's port has no lat/lng (curated-only ports
 * not yet enriched in 00104), the route falls back to city-only scope
 * with no distance sort — the legacy behavior.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'employer' && person.current_hat !== 'agent') {
      return NextResponse.json({ error: 'Employer or agent role required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const allRoles = url.searchParams.get('allRoles') === 'true';

    // Fetch daywork with role_id and location
    const { data: daywork } = await supabase
      .from('dayworks')
      .select(
        'id, poster_person_id, start_date, end_date, role_id, location_port_id, status, positions_available',
      )
      .eq('id', dayworkId)
      .single();

    if (!daywork) {
      return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
    }

    if (daywork.poster_person_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
    }

    // Hoist these so the closures below have a stable reference (TS
    // can't see through the early-return narrowing inside arrow funcs).
    const dayworkPortId = daywork.location_port_id as string;
    const dayworkRoleId = daywork.role_id as string;
    const invitationLimit = (daywork.positions_available ?? 1) + 2;

    if (daywork.status !== 'active') {
      return NextResponse.json({
        crew: [],
        invitation_count: 0,
        invitation_limit: invitationLimit,
      });
    }

    // Origin port: lat/lng + city + region. The city's region drives the
    // region-wide expansion; the lat/lng drives the distance sort. When
    // origin coords are missing we degrade gracefully to city-only.
    const { data: originPort } = await supabase
      .from('ports')
      .select('city_id, latitude, longitude, cities:city_id(region_id)')
      .eq('id', daywork.location_port_id)
      .single();

    if (!originPort) {
      return NextResponse.json({
        crew: [],
        invitation_count: 0,
        invitation_limit: invitationLimit,
      });
    }

    const originCityId = originPort.city_id as string;
    const originRegionId =
      (originPort.cities as unknown as { region_id?: string } | null)?.region_id ?? null;
    const originLat = originPort.latitude as number | null;
    const originLng = originPort.longitude as number | null;
    const hasOriginCoords = Number.isFinite(originLat) && Number.isFinite(originLng);

    // Build the city set we'll match against. With a known region,
    // expand to every city in that region (broader pool, employer
    // gets crew willing to commute within the same maritime hub).
    // Without a region (orphan city), fall back to city-only.
    let regionCityIds: string[] = [originCityId];
    if (originRegionId) {
      const { data: regionCities } = await supabase
        .from('cities')
        .select('id')
        .eq('region_id', originRegionId);
      const ids = ((regionCities ?? []) as { id: string }[]).map((c) => c.id);
      if (ids.length > 0) regionCityIds = ids;
    }

    // Find non-expired availability rows in the matched cities.
    // Switch to serviceClient so the per-row owner RLS policy doesn't
    // hide rows from the employer caller.
    const { data: availWindows } = await serviceClient
      .from('availability_windows')
      .select('person_id, date, city_id, port_id, not_available, created_at')
      .in('city_id', regionCityIds)
      .eq('not_available', false)
      .gte('date', daywork.start_date)
      .lte('date', daywork.end_date)
      .gt('expires_at', new Date().toISOString());

    if (!availWindows || availWindows.length === 0) {
      const { count: invCount } = await supabase
        .from('daywork_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('daywork_id', dayworkId)
        .eq('status', 'pending');
      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Aggregate per person: available_days, latest created_at, anchor
    // (city_id always present, port_id if pinned).
    interface CandidateAgg {
      person_id: string;
      available_days: number;
      latest_created_at: string;
      city_id: string;
      port_id: string | null;
    }
    const aggMap = new Map<string, CandidateAgg>();
    for (const w of availWindows as Array<{
      person_id: string;
      city_id: string;
      port_id: string | null;
      created_at: string;
    }>) {
      const existing = aggMap.get(w.person_id);
      if (existing) {
        existing.available_days += 1;
        if (w.created_at > existing.latest_created_at) existing.latest_created_at = w.created_at;
        // Prefer a pinned port over none (port_id is the more precise anchor).
        if (!existing.port_id && w.port_id) existing.port_id = w.port_id;
      } else {
        aggMap.set(w.person_id, {
          person_id: w.person_id,
          available_days: 1,
          latest_created_at: w.created_at,
          city_id: w.city_id,
          port_id: w.port_id,
        });
      }
    }

    // Exclude employer self, then filter by application + invitation
    // state (not already applied / invited on THIS posting).
    let candidateIds = Array.from(aggMap.keys()).filter((id) => id !== user.id);

    if (candidateIds.length > 0) {
      const [{ data: existingApps }, { data: existingInvitations }] = await Promise.all([
        supabase
          .from('applications')
          .select('crew_person_id')
          .eq('daywork_id', dayworkId)
          .in('crew_person_id', candidateIds),
        supabase
          .from('daywork_invitations')
          .select('crew_person_id')
          .eq('daywork_id', dayworkId)
          .in('crew_person_id', candidateIds),
      ]);
      const appliedSet = new Set((existingApps ?? []).map((a) => a.crew_person_id));
      const invitedSet = new Set((existingInvitations ?? []).map((i) => i.crew_person_id));
      candidateIds = candidateIds.filter((id) => !appliedSet.has(id) && !invitedSet.has(id));
    }

    // Pro gate — only Crew Pro subscribers surface in the available
    // crew tab. The "discoverability" promise of Crew Pro hinges on
    // this filter.
    if (candidateIds.length > 0) {
      const { data: proSubs } = await serviceClient
        .from('subscriptions')
        .select('person_id')
        .in('person_id', candidateIds)
        .eq('plan', 'crew_pro')
        .in('status', ['active', 'trialing']);
      const proSet = new Set((proSubs ?? []).map((s: { person_id: string }) => s.person_id));
      candidateIds = candidateIds.filter((id) => proSet.has(id));
    }

    // Pending invitation count for the response (computed once, used in
    // both the normal return and any short-circuit empty branches).
    const { count: invCount } = await supabase
      .from('daywork_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('daywork_id', dayworkId)
      .eq('status', 'pending');

    if (candidateIds.length === 0) {
      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Build the anchor coords for each surviving candidate. Pinned port
    // wins; otherwise we use a centroid of their city's ports as a
    // representative point. Two batched queries (ports we've seen,
    // then ports of cities that need a centroid) keep this O(1) extra
    // round-trips per request regardless of candidate count.
    const candidateAggs = candidateIds
      .map((id) => aggMap.get(id))
      .filter(Boolean) as CandidateAgg[];

    const portIds = new Set<string>();
    const cityIdsNeedingCentroid = new Set<string>();
    for (const c of candidateAggs) {
      if (c.port_id) portIds.add(c.port_id);
      else cityIdsNeedingCentroid.add(c.city_id);
    }

    const portCoordMap = new Map<string, { latitude: number | null; longitude: number | null }>();
    if (portIds.size > 0) {
      const { data: portRows } = await supabase
        .from('ports')
        .select('id, latitude, longitude')
        .in('id', Array.from(portIds));
      for (const p of (portRows ?? []) as Array<{
        id: string;
        latitude: number | null;
        longitude: number | null;
      }>) {
        portCoordMap.set(p.id, { latitude: p.latitude, longitude: p.longitude });
      }
    }

    const cityCentroidMap = new Map<string, { latitude: number; longitude: number } | null>();
    if (cityIdsNeedingCentroid.size > 0) {
      const { data: cityPorts } = await supabase
        .from('ports')
        .select('city_id, latitude, longitude')
        .in('city_id', Array.from(cityIdsNeedingCentroid));
      const grouped = new Map<
        string,
        Array<{ latitude: number | null; longitude: number | null }>
      >();
      for (const r of (cityPorts ?? []) as Array<{
        city_id: string;
        latitude: number | null;
        longitude: number | null;
      }>) {
        if (!grouped.has(r.city_id)) grouped.set(r.city_id, []);
        grouped.get(r.city_id)!.push({ latitude: r.latitude, longitude: r.longitude });
      }
      for (const [cid, points] of grouped) {
        cityCentroidMap.set(cid, pointsCentroid(points));
      }
    }

    /** Resolve a candidate's anchor lat/lng — pinned port if present,
     *  else the city centroid. Returns null when neither is available
     *  (fall-through for cities with no port lat/lngs). */
    function anchorFor(c: CandidateAgg): { latitude: number; longitude: number } | null {
      if (c.port_id) {
        const p = portCoordMap.get(c.port_id);
        if (p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
          return { latitude: p.latitude as number, longitude: p.longitude as number };
        }
      }
      return cityCentroidMap.get(c.city_id) ?? null;
    }

    /** Bucket label drives the UI pill. Same-port wins when crew pinned
     *  to the same port the daywork is at; same-city for any other crew
     *  whose city matches the daywork's city; same-region otherwise. */
    function bucketFor(c: CandidateAgg): DistanceBucket {
      if (c.port_id && c.port_id === dayworkPortId) return 'same-port';
      if (c.city_id === originCityId) return 'same-city';
      return 'same-region';
    }

    interface ScoredCandidate extends CandidateAgg {
      distance_km: number;
      bucket: DistanceBucket;
    }
    const scored: ScoredCandidate[] = [];
    for (const c of candidateAggs) {
      const bucket = bucketFor(c);
      let distance_km = Number.POSITIVE_INFINITY;
      if (hasOriginCoords) {
        const anchor = anchorFor(c);
        if (anchor) {
          distance_km = haversineKm(originLat, originLng, anchor.latitude, anchor.longitude);
        }
        if (Number.isFinite(distance_km) && distance_km > MAX_DISTANCE_KM) {
          // 200km ceiling — drop candidates beyond, even if region matches.
          continue;
        }
      }
      scored.push({ ...c, distance_km, bucket });
    }

    // Stable tiebreak chain: distance ASC, available_days DESC,
    // latest availability refresh DESC, person_id ASC.
    scored.sort((a, b) => {
      if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
      if (a.available_days !== b.available_days) return b.available_days - a.available_days;
      if (a.latest_created_at !== b.latest_created_at) {
        return b.latest_created_at < a.latest_created_at ? -1 : 1;
      }
      return a.person_id < b.person_id ? -1 : 1;
    });

    const final = scored.slice(0, MAX_RESULTS);
    const finalIds = final.map((c) => c.person_id);

    if (finalIds.length === 0) {
      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Fetch profiles + shore experiences only for the final set.
    const [{ data: profiles }, { data: shoreExps }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          `
          person_id, display_name, avatar_url, primary_role_id, certification_ids, languages,
          experience_bracket_id, vessel_size_exposure_ids, bio, location_port_id,
          nationality_id, nationality_ids,
          yacht_roles:primary_role_id(id, name, department),
          experience_brackets:experience_bracket_id(label),
          ports:location_port_id(name, cities(name, regions(name))),
          nationalities:nationality_id(name, country_code, flag_emoji)
        `,
        )
        .in('person_id', finalIds),
      supabase
        .from('shore_experiences')
        .select('person_id, shore_experience_categories(name)')
        .in('person_id', finalIds),
    ]);

    // Apply role filter (default: match daywork's role_id) AFTER the
    // distance/Pro pipeline so a wider sweep with allRoles=true still
    // respects the proximity ranking.
    let matchedProfiles = profiles ?? [];
    if (!allRoles) {
      matchedProfiles = matchedProfiles.filter((p) => p.primary_role_id === dayworkRoleId);
    }

    const shoreCategoryMap: Record<string, string[]> = {};
    for (const se of shoreExps ?? []) {
      const cat = se.shore_experience_categories as unknown as { name: string } | null;
      if (cat?.name) {
        if (!shoreCategoryMap[se.person_id]) shoreCategoryMap[se.person_id] = [];
        if (!shoreCategoryMap[se.person_id].includes(cat.name)) {
          shoreCategoryMap[se.person_id].push(cat.name);
        }
      }
    }

    // Re-attach the ranking metadata to the profile rows in the order
    // the scored array decided. The role filter may have removed some
    // of them — keep the surviving order intact.
    const profileById = new Map(matchedProfiles.map((p) => [p.person_id, p]));
    const crew = final
      .filter((s) => profileById.has(s.person_id))
      .map((s) => {
        const p = profileById.get(s.person_id)!;
        return {
          person_id: p.person_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          primary_role_id: p.primary_role_id,
          certification_ids: p.certification_ids,
          experience_bracket_id: p.experience_bracket_id,
          vessel_size_exposure_ids: p.vessel_size_exposure_ids,
          bio: p.bio,
          location_port_id: p.location_port_id,
          yacht_roles: p.yacht_roles,
          experience_brackets: p.experience_brackets,
          ports: p.ports,
          available_days: s.available_days,
          shore_experience_categories: shoreCategoryMap[p.person_id] ?? [],
          // Bucket label drives the same-port / same-city / same-region
          // pill on the card. Distance is intentionally NOT exposed —
          // the order communicates proximity without false precision.
          proximity: s.bucket,
        };
      });

    return NextResponse.json({
      crew,
      invitation_count: invCount ?? 0,
      invitation_limit: invitationLimit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
