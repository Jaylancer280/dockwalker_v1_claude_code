import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export interface DiscoverFilters {
  roleId?: string;
  portId?: string;
  certificationId?: string;
  experienceBracketId?: string;
  sizeBandId?: string;
}

interface RawDaywork {
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
  positions_available: number;
  permanent_opportunity: boolean;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  experience_brackets: { label: string } | null;
  required_certification_ids: string[] | null;
  required_languages: string[];
}

interface PublicVessel {
  id: string;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  size_band_id: string;
  size_band_label: string | null;
  nda_flag: boolean;
}

export interface HydratedDaywork {
  id: string;
  job_number: number;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  created_at: string;
  poster_person_id: string;
  poster_name: string | null;
  positions_available: number;
  permanent_opportunity: boolean;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  experience_brackets: { label: string } | null;
  required_languages: string[];
  cert_names: string[];
  vessels: {
    name: string;
    nda_flag: boolean;
    vessel_type: string;
    loa_meters: number | null;
    vessel_size_bands: { label: string } | null;
  } | null;
}

const BATCH_SIZE = 50;

async function fetchDayworkDiscover(
  userId: string,
  filters: DiscoverFilters,
): Promise<HydratedDaywork[]> {
  // 1. Get IDs of dayworks crew already interacted with
  const { data: existingApps } = await supabase
    .from('applications')
    .select('daywork_id')
    .eq('crew_person_id', userId)
    .in('status', ['applied', 'viewed', 'shortlisted', 'accepted', 'superseded', 'withdrawn']);

  const excludedIds = (existingApps ?? []).map((a) => a.daywork_id).filter(Boolean) as string[];

  // 2. Build query
  let query = supabase
    .from('dayworks')
    .select(
      `id, job_number, vessel_id, start_date, end_date, working_days, day_rate, currency, meals, notes, status, created_at,
       poster_person_id, positions_available, permanent_opportunity,
       yacht_roles(id, name, department),
       ports(id, name, cities(name, regions(name))),
       experience_brackets(label),
       required_certification_ids, required_languages`,
    )
    .eq('status', 'active')
    .neq('poster_person_id', userId);

  if (excludedIds.length > 0) {
    query = query.not('id', 'in', `(${excludedIds.join(',')})`);
  }

  if (filters.roleId) query = query.eq('role_id', filters.roleId);
  if (filters.portId) query = query.eq('location_port_id', filters.portId);
  if (filters.certificationId) {
    if (filters.certificationId === 'none') {
      query = query.eq('required_certification_ids', '{}');
    } else {
      query = query.contains('required_certification_ids', [filters.certificationId]);
    }
  }
  if (filters.experienceBracketId) {
    query = query.eq('experience_bracket_id', filters.experienceBracketId);
  }

  const fetchLimit = filters.sizeBandId ? 200 : BATCH_SIZE;
  const { data: dayworks, error } = await query
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (error) throw error;

  const rows = (dayworks ?? []) as unknown as RawDaywork[];

  // 3. Resolve vessels via get_vessel_public RPC
  const vesselIds = [...new Set(rows.map((dw) => dw.vessel_id).filter(Boolean))];
  const vesselMap = new Map<string, PublicVessel | null>();
  await Promise.all(
    vesselIds.map(async (vesselId) => {
      const { data } = await supabase.rpc('get_vessel_public', { p_vessel_id: vesselId });
      const vessel = Array.isArray(data) ? data[0] : data;
      vesselMap.set(vesselId, vessel ? (vessel as PublicVessel) : null);
    }),
  );

  // 4. Resolve poster names
  const posterIds = [...new Set(rows.map((d) => d.poster_person_id))];
  const posterNameMap = new Map<string, string>();
  if (posterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('person_id, display_name')
      .in('person_id', posterIds);
    for (const p of profiles ?? []) {
      posterNameMap.set(p.person_id, p.display_name);
    }
  }

  // 5. Resolve cert names
  const allCertIds = [...new Set(rows.flatMap((r) => r.required_certification_ids ?? []))];
  const certNameMap = new Map<string, string>();
  if (allCertIds.length > 0) {
    const { data: certs } = await supabase
      .from('certifications')
      .select('id, name')
      .in('id', allCertIds);
    for (const c of certs ?? []) {
      certNameMap.set(c.id, c.name);
    }
  }

  // 6. Hydrate
  let hydrated: HydratedDaywork[] = rows.map((dw) => {
    const vessel = vesselMap.get(dw.vessel_id);
    return {
      id: dw.id,
      job_number: dw.job_number,
      start_date: dw.start_date,
      end_date: dw.end_date,
      working_days: dw.working_days,
      day_rate: dw.day_rate,
      currency: dw.currency,
      meals: dw.meals,
      notes: dw.notes,
      created_at: dw.created_at,
      poster_person_id: dw.poster_person_id,
      poster_name: posterNameMap.get(dw.poster_person_id) ?? null,
      positions_available: dw.positions_available,
      permanent_opportunity: dw.permanent_opportunity,
      yacht_roles: dw.yacht_roles,
      ports: dw.ports as HydratedDaywork['ports'],
      experience_brackets: dw.experience_brackets,
      required_languages: dw.required_languages ?? [],
      cert_names: (dw.required_certification_ids ?? []).map((id) => certNameMap.get(id) ?? id),
      vessels: vessel
        ? {
            name: vessel.name,
            nda_flag: vessel.nda_flag,
            vessel_type: vessel.vessel_type,
            loa_meters: vessel.loa_meters,
            vessel_size_bands: vessel.size_band_label ? { label: vessel.size_band_label } : null,
          }
        : null,
    };
  });

  // 7. Post-fetch size band filter
  if (filters.sizeBandId) {
    hydrated = hydrated.filter((dw) => {
      const vessel = vesselMap.get(
        rows.find((r) => r.id === dw.id)?.vessel_id ?? '',
      );
      return vessel?.size_band_id === filters.sizeBandId;
    });
    hydrated = hydrated.slice(0, BATCH_SIZE);
  }

  return hydrated;
}

export function useDayworkDiscover(filters: DiscoverFilters = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<HydratedDaywork[]>({
    queryKey: ['daywork-discover', user?.id, filters],
    queryFn: () => fetchDayworkDiscover(user!.id, filters),
    enabled: !!user,
  });

  function removeCard(dayworkId: string) {
    queryClient.setQueryData<HydratedDaywork[]>(
      ['daywork-discover', user?.id, filters],
      (old) => old?.filter((dw) => dw.id !== dayworkId),
    );
  }

  return { ...query, removeCard };
}
