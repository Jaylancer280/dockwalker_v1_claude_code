import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface DiscoverDayworkRow {
  id: string;
  job_number: number;
  vessel_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  status: string;
  created_at: string;
  poster_person_id: string;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } } | null;
  } | null;
  experience_brackets: { label: string } | null;
  required_certification_ids: string[] | null;
}

interface PublicVesselRow {
  id: string;
  imo_number: string | null;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  size_band_id: string;
  size_band_label: string | null;
  nda_flag: boolean;
  owner_person_id: string;
}

/**
 * GET /api/daywork/discover?roleId=&portId=&startDate=&endDate=&certificationId=&experienceBracketId=&sizeBandId=
 * Returns active daywork postings for crew discovery.
 * Excludes the crew's own postings and jobs they have already interacted with.
 * Ordered by recency (newest first).
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    const isAgent = person.identity_type === 'agent';
    if (person.current_hat !== 'crew' && !isAgent) {
      return NextResponse.json({ error: 'Only crew can discover jobs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterRoleId = searchParams.get('roleId');
    const filterPortId = searchParams.get('portId');
    const filterStartDate = searchParams.get('startDate');
    const filterEndDate = searchParams.get('endDate');
    const filterCertificationId = searchParams.get('certificationId');
    const filterExperienceBracketId = searchParams.get('experienceBracketId');
    const filterSizeBandId = searchParams.get('sizeBandId');
    const cursor = searchParams.get('cursor');

    // Get IDs of dayworks this crew has already interacted with
    const { data: existingApps } = await supabase
      .from('applications')
      .select('daywork_id')
      .eq('crew_person_id', user.id)
      .in('status', ['applied', 'viewed', 'shortlisted', 'accepted', 'superseded', 'withdrawn']);

    const excludedIds = (existingApps ?? []).map((a) => a.daywork_id).filter(Boolean);

    // Build query for active dayworks, ordered by recency.
    // Exclusions are applied at the DB level so the limit operates on already-filtered rows.
    let query = supabase
      .from('dayworks')
      .select(
        `
      id, job_number, vessel_id, start_date, end_date, working_days, day_rate, currency, meals, notes, status, created_at,
      poster_person_id, positions_available, permanent_opportunity,
      yacht_roles(id, name, department),
      ports(id, name, cities(name, regions(name))),
      experience_brackets(label),
      required_certification_ids, required_languages
    `,
      )
      .eq('status', 'active')
      .neq('poster_person_id', user.id);

    if (excludedIds.length > 0) {
      query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    if (filterRoleId) {
      query = query.eq('role_id', filterRoleId);
    }
    if (filterPortId) {
      query = query.eq('location_port_id', filterPortId);
    }
    if (filterStartDate) {
      query = query.gte('start_date', filterStartDate);
    }
    if (filterEndDate) {
      query = query.lte('end_date', filterEndDate);
    }
    if (filterCertificationId) {
      if (filterCertificationId === 'none') {
        query = query.eq('required_certification_ids', '{}');
      } else {
        // Bundle-aware filter — see permanent/discover for rationale.
        const { data: componentsRows } = await supabase
          .from('certification_components')
          .select('component_cert_id')
          .eq('bundle_cert_id', filterCertificationId);
        const expanded = [
          filterCertificationId,
          ...((componentsRows as { component_cert_id: string }[] | null) ?? []).map(
            (r) => r.component_cert_id,
          ),
        ];
        query = query.overlaps('required_certification_ids', expanded);
      }
    }
    if (filterExperienceBracketId) {
      query = query.eq('experience_bracket_id', filterExperienceBracketId);
    }
    // Pre-filter by vessel size band at the DB level (avoids fetching 200 rows)
    if (filterSizeBandId) {
      const { data: matchingVessels } = await supabase
        .from('vessels')
        .select('id')
        .eq('size_band_id', filterSizeBandId);
      const matchingVesselIds = (matchingVessels ?? []).map((v) => v.id);
      if (matchingVesselIds.length === 0) {
        return NextResponse.json({ dayworks: [], has_more: false, next_cursor: null });
      }
      query = query.in('vessel_id', matchingVesselIds);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    query = query.order('created_at', { ascending: false });

    const BATCH_SIZE = 20;
    const { data: dayworks, error } = await query.limit(BATCH_SIZE);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = (dayworks ?? []) as unknown as DiscoverDayworkRow[];

    const vesselIds = [...new Set(filtered.map((dw) => dw.vessel_id).filter(Boolean))];
    const posterIds = [...new Set(filtered.map((d) => d.poster_person_id))];
    const allCertIds = [...new Set(filtered.flatMap((r) => r.required_certification_ids ?? []))];

    const [vesselResult, posterResult, certResult] = await Promise.all([
      vesselIds.length > 0
        ? supabase.rpc('get_vessels_public_batch', { p_vessel_ids: vesselIds })
        : Promise.resolve({ data: null, error: null }),
      posterIds.length > 0
        ? supabase
            .from('profiles')
            .select('person_id, display_name, identity_type')
            .in('person_id', posterIds)
        : Promise.resolve({ data: null, error: null }),
      allCertIds.length > 0
        ? supabase.from('certifications').select('id, name').in('id', allCertIds)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (vesselResult.error) {
      return NextResponse.json({ error: vesselResult.error.message }, { status: 500 });
    }
    if (posterResult.error) {
      return NextResponse.json({ error: posterResult.error.message }, { status: 500 });
    }

    const vesselMap = new Map<string, PublicVesselRow | null>();
    for (const v of (vesselResult.data ?? []) as PublicVesselRow[]) {
      vesselMap.set(v.id, v);
    }

    const posterNameMap = new Map<string, string>();
    const posterIdentityMap = new Map<string, string>();
    for (const p of posterResult.data ?? []) {
      posterNameMap.set(p.person_id, p.display_name);
      posterIdentityMap.set(p.person_id, p.identity_type);
    }

    const certNameMap = new Map<string, string>();
    for (const c of certResult.data ?? []) {
      certNameMap.set(c.id, c.name);
    }

    const hydrated = filtered.map((daywork) => {
      const vessel = vesselMap.get(daywork.vessel_id);
      const row = daywork as DiscoverDayworkRow & {
        positions_available: number;
      };

      const certIds = daywork.required_certification_ids ?? [];

      return {
        ...daywork,
        cert_names: certIds.map((id) => certNameMap.get(id) ?? id),
        positions_available: row.positions_available,
        poster_name: posterNameMap.get(daywork.poster_person_id) ?? null,
        poster_is_agent: posterIdentityMap.get(daywork.poster_person_id) === 'agent',
        vessels: vessel
          ? {
              name: vessel.name,
              nda_flag: vessel.nda_flag,
              vessel_type: vessel.vessel_type,
              loa_meters: vessel.loa_meters,
              size_band_id: vessel.size_band_id,
              vessel_size_bands: vessel.size_band_label ? { label: vessel.size_band_label } : null,
            }
          : null,
      };
    });

    const hasMore = filtered.length === BATCH_SIZE;
    const nextCursor =
      hasMore && hydrated.length > 0 ? hydrated[hydrated.length - 1].created_at : null;

    // Strip poster identity for agents
    const results = isAgent
      ? hydrated.map((dw) => ({
          ...dw,
          poster_person_id: null as string | null,
          poster_name: null as string | null,
        }))
      : hydrated;

    return NextResponse.json({ dayworks: results, has_more: hasMore, next_cursor: nextCursor });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
