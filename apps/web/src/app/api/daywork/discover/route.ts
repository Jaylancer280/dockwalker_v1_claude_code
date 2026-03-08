import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface DiscoverDayworkRow {
  id: string;
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
  size_band_id: string;
  size_band_label: string | null;
  nda_flag: boolean;
  owner_person_id: string;
}

/**
 * GET /api/daywork/discover?roleId=&portId=&startDate=&endDate=
 * Returns active daywork postings for crew discovery.
 * Excludes the crew's own postings and jobs they have already interacted with.
 * Ordered by recency (newest first).
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can discover jobs' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filterRoleId = searchParams.get('roleId');
  const filterPortId = searchParams.get('portId');
  const filterStartDate = searchParams.get('startDate');
  const filterEndDate = searchParams.get('endDate');

  // Get IDs of dayworks this crew has already interacted with
  const { data: existingApps } = await supabase
    .from('applications')
    .select('daywork_id')
    .eq('crew_person_id', user.id)
    .in('status', ['applied', 'viewed', 'shortlisted', 'accepted', 'superseded', 'withdrawn']);

  const excludedIds = (existingApps ?? []).map((a) => a.daywork_id);

  // Build query for active dayworks, ordered by recency
  let query = supabase
    .from('dayworks')
    .select(
      `
      id, vessel_id, start_date, end_date, working_days, day_rate, currency, meals, notes, status, created_at,
      poster_person_id,
      yacht_roles(id, name, department),
      ports(id, name, cities(name, regions(name))),
      experience_brackets(label),
      required_certification_ids
    `,
    )
    .eq('status', 'active');

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

  query = query.order('created_at', { ascending: false });

  const { data: dayworks, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Client-side filtering for exclusions that can't be done in a single Supabase query
  const filtered = ((dayworks ?? []) as unknown as DiscoverDayworkRow[]).filter((dw) => {
    if (excludedIds.includes(dw.id)) return false;
    if (dw.poster_person_id === user.id) return false;
    return true;
  });

  const vesselIds = [...new Set(filtered.map((dw) => dw.vessel_id).filter(Boolean))];
  const vesselEntries: Array<[string, PublicVesselRow | null]> = await Promise.all(
    vesselIds.map(async (vesselId): Promise<[string, PublicVesselRow | null]> => {
      const { data, error } = await supabase.rpc('get_vessel_public', {
        p_vessel_id: vesselId,
      });

      if (error) {
        return [vesselId, null];
      }

      const vessel = Array.isArray(data) ? data[0] : data;

      return vessel ? [vesselId, vessel as PublicVesselRow] : [vesselId, null];
    }),
  );

  const vesselMap = new Map<string, PublicVesselRow | null>(vesselEntries);

  const hydrated = filtered.map((daywork) => {
    const vessel = vesselMap.get(daywork.vessel_id);

    return {
      ...daywork,
      vessels: vessel
        ? {
            name: vessel.name,
            nda_flag: vessel.nda_flag,
            vessel_type: vessel.vessel_type,
            vessel_size_bands: vessel.size_band_label ? { label: vessel.size_band_label } : null,
          }
        : null,
    };
  });

  return NextResponse.json({ dayworks: hydrated });
}
