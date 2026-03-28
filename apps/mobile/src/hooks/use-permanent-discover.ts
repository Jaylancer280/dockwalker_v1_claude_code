import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export interface PermanentFilters {
  roleId?: string;
  portId?: string;
  certificationId?: string;
  experienceBracketId?: string;
  sizeBandId?: string;
  salaryMin?: number;
  liveAboard?: boolean;
}

export interface HydratedPermanent {
  id: string;
  job_number: number;
  start_date: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  live_aboard: boolean;
  shortlist_cap: number;
  notes: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  meals: string[];
  positions_available: number;
  created_at: string;
  required_languages: string[];
  cert_names: string[];
  required_certification_ids: string[];
  role_name: string | null;
  role_department: string | null;
  port_name: string | null;
  city_name: string | null;
  region_name: string | null;
  vessel_name: string | null;
  vessel_nda: boolean;
  vessel_type: string | null;
  vessel_size_label: string | null;
  vessel_loa: number | null;
  experience_label: string | null;
  poster_name: string | null;
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

const BATCH_SIZE = 20;

async function fetchPage(
  userId: string,
  filters: PermanentFilters,
  cursor?: string,
): Promise<{ postings: HydratedPermanent[]; nextCursor: string | null }> {
  // Excluded IDs
  const { data: existingApps } = await supabase
    .from('applications')
    .select('permanent_posting_id')
    .eq('crew_person_id', userId)
    .not('permanent_posting_id', 'is', null)
    .in('status', ['applied', 'shortlisted', 'selected', 'withdrawn', 'not_selected', 'rejected']);

  const excludedIds = (existingApps ?? [])
    .map((a) => a.permanent_posting_id as string)
    .filter(Boolean);

  let query = supabase
    .from('permanent_postings')
    .select(
      `id, job_number, vessel_id, role_id, port_id, start_date,
       salary_min, salary_max, salary_currency, salary_period,
       live_aboard, required_certification_ids, required_languages, experience_bracket_id,
       shortlist_cap, notes, contract_type, contract_details, description, meals,
       positions_available, status, created_at, employer_person_id,
       yacht_roles(id, name, department),
       ports(id, name, cities(name, regions(name))),
       experience_brackets(label)`,
    )
    .in('status', ['active', 'in_negotiation'])
    .neq('employer_person_id', userId);

  if (excludedIds.length > 0) {
    query = query.not('id', 'in', `(${excludedIds.join(',')})`);
  }

  if (filters.roleId) query = query.eq('role_id', filters.roleId);
  if (filters.portId) query = query.eq('port_id', filters.portId);
  if (filters.certificationId) {
    if (filters.certificationId === 'none') {
      query = query.eq('required_certification_ids', '{}');
    } else {
      query = query.contains('required_certification_ids', [filters.certificationId]);
    }
  }
  if (filters.experienceBracketId) query = query.eq('experience_bracket_id', filters.experienceBracketId);
  if (filters.salaryMin) query = query.gte('salary_max', filters.salaryMin);
  if (filters.liveAboard !== undefined) query = query.eq('live_aboard', filters.liveAboard);
  if (cursor) query = query.lt('created_at', cursor);

  const fetchLimit = filters.sizeBandId ? BATCH_SIZE * 10 : BATCH_SIZE;
  const { data: postings, error } = await query
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (error) throw error;
  const rows = (postings ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return { postings: [], nextCursor: null };

  // Vessel hydration
  const vesselIds = [...new Set(rows.map((r) => r.vessel_id as string).filter(Boolean))];
  const vesselMap = new Map<string, PublicVessel | null>();
  await Promise.all(
    vesselIds.map(async (vesselId) => {
      const { data } = await supabase.rpc('get_vessel_public', { p_vessel_id: vesselId });
      const vessel = Array.isArray(data) ? data[0] : data;
      vesselMap.set(vesselId, vessel ? (vessel as PublicVessel) : null);
    }),
  );

  // Poster names
  const posterIds = [...new Set(rows.map((r) => r.employer_person_id as string))];
  const posterNameMap = new Map<string, string>();
  if (posterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('person_id, display_name')
      .in('person_id', posterIds);
    for (const p of profiles ?? []) posterNameMap.set(p.person_id, p.display_name);
  }

  // Cert names
  const allCertIds = [...new Set(rows.flatMap((r) => (r.required_certification_ids as string[]) ?? []))];
  const certNameMap = new Map<string, string>();
  if (allCertIds.length > 0) {
    const { data: certs } = await supabase.from('certifications').select('id, name').in('id', allCertIds);
    for (const c of certs ?? []) certNameMap.set(c.id, c.name);
  }

  let hydrated: HydratedPermanent[] = rows.map((p) => {
    const vessel = vesselMap.get(p.vessel_id as string);
    const role = p.yacht_roles as { id: string; name: string; department: string } | null;
    const port = p.ports as { id: string; name: string; cities: { name: string; regions: { name: string } } } | null;
    const exp = p.experience_brackets as { label: string } | null;
    const certIds = (p.required_certification_ids as string[]) ?? [];

    return {
      id: p.id as string,
      job_number: p.job_number as number,
      start_date: p.start_date as string,
      salary_min: p.salary_min as number | null,
      salary_max: p.salary_max as number | null,
      salary_currency: p.salary_currency as string,
      salary_period: p.salary_period as string,
      live_aboard: p.live_aboard as boolean,
      shortlist_cap: p.shortlist_cap as number,
      notes: p.notes as string | null,
      contract_type: p.contract_type as string | null,
      contract_details: p.contract_details as string | null,
      description: p.description as string | null,
      meals: (p.meals as string[]) ?? [],
      positions_available: p.positions_available as number,
      created_at: p.created_at as string,
      required_languages: (p.required_languages as string[]) ?? [],
      cert_names: certIds.map((id) => certNameMap.get(id) ?? id),
      required_certification_ids: certIds,
      role_name: role?.name ?? null,
      role_department: role?.department ?? null,
      port_name: port?.name ?? null,
      city_name: port?.cities?.name ?? null,
      region_name: port?.cities?.regions?.name ?? null,
      vessel_name: vessel?.name ?? null,
      vessel_nda: vessel?.nda_flag ?? false,
      vessel_type: vessel?.vessel_type ?? null,
      vessel_size_label: vessel?.size_band_label ?? null,
      vessel_loa: vessel?.loa_meters ?? null,
      experience_label: exp?.label ?? null,
      poster_name: posterNameMap.get(p.employer_person_id as string) ?? null,
    };
  });

  if (filters.sizeBandId) {
    hydrated = hydrated.filter((p) => {
      const vessel = vesselMap.get(rows.find((r) => r.id === p.id)?.vessel_id as string ?? '');
      return vessel?.size_band_id === filters.sizeBandId;
    });
    hydrated = hydrated.slice(0, BATCH_SIZE);
  }

  const hasMore = filters.sizeBandId ? hydrated.length > BATCH_SIZE : rows.length === BATCH_SIZE;
  const nextCursor = hasMore && hydrated.length > 0 ? hydrated[hydrated.length - 1].created_at : null;

  return { postings: hydrated, nextCursor };
}

export function usePermanentDiscover(filters: PermanentFilters = {}) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['permanent-discover', user?.id, filters],
    queryFn: ({ pageParam }) => fetchPage(user!.id, filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user,
  });
}
