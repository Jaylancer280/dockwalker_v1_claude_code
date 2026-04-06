import { createServiceClient } from '@/lib/supabase/server';

export interface PublicJobData {
  job_number: string;
  type: 'daywork' | 'permanent';
  role_name: string;
  department: string;
  vessel_name: string;
  vessel_type: string;
  size_band: string | null;
  loa_meters: number | null;
  region: string | null;
  city: string | null;
  port: string | null;
  start_date?: string;
  end_date?: string;
  working_days?: number;
  day_rate?: number;
  currency?: string;
  meals?: string[];
  positions_available?: number;
  permanent_opportunity?: boolean;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  contract_type?: string;
  live_aboard?: boolean;
  shortlist_cap?: number;
  required_certs: string[];
  required_languages: string[];
  experience_bracket: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}

const JOB_NUMBER_RE = /^(DW|PM)-(\d{5})$/;

type PortJoin = { name: string; cities: { name: string; regions: { name: string } } } | null;
type VesselJoin = {
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  nda_flag: boolean;
  vessel_size_bands: { label: string } | null;
} | null;

/**
 * Fetch a public job by job number (e.g. "DW-00001" or "PM-00003").
 * Uses service client — no auth required. NDA vessels masked.
 * Returns null if not found, inactive, or malformed input.
 */
export async function getPublicJob(jobNumber: string): Promise<PublicJobData | null> {
  const match = JOB_NUMBER_RE.exec(jobNumber);
  if (!match) return null;

  const prefix = match[1];
  const num = parseInt(match[2], 10);
  const sc = await createServiceClient();

  if (prefix === 'DW') {
    const { data: dw } = await sc
      .from('dayworks')
      .select(
        `id, job_number, status, start_date, end_date, working_days,
        day_rate, currency, meals, notes, positions_available,
        permanent_opportunity, required_languages,
        vessel_id, role_id, location_port_id,
        required_certification_ids, experience_bracket_id, created_at`,
      )
      .eq('job_number', num)
      .eq('status', 'active')
      .single();

    if (!dw) return null;

    const [role, port, bracket, vessel, certs] = await Promise.all([
      dw.role_id
        ? sc.from('yacht_roles').select('name, department').eq('id', dw.role_id).single()
        : null,
      dw.location_port_id
        ? sc
            .from('ports')
            .select('name, cities(name, regions(name))')
            .eq('id', dw.location_port_id)
            .single()
        : null,
      dw.experience_bracket_id
        ? sc.from('experience_brackets').select('label').eq('id', dw.experience_bracket_id).single()
        : null,
      dw.vessel_id
        ? sc
            .from('vessels')
            .select(
              'name, vessel_type, loa_meters, nda_flag, vessel_size_bands:size_band_id(label)',
            )
            .eq('id', dw.vessel_id)
            .single()
        : null,
      dw.required_certification_ids?.length > 0
        ? sc.from('certifications').select('name').in('id', dw.required_certification_ids)
        : null,
    ]);

    const portData = port?.data as PortJoin;
    const vesselData = vessel?.data as VesselJoin;

    return {
      job_number: jobNumber,
      type: 'daywork',
      role_name: role?.data?.name ?? 'Unknown Role',
      department: role?.data?.department ?? 'deck',
      vessel_name: vesselData?.nda_flag ? 'NDA Vessel' : (vesselData?.name ?? 'Unknown Vessel'),
      vessel_type: vesselData?.vessel_type ?? 'motor',
      size_band: vesselData?.vessel_size_bands?.label ?? null,
      loa_meters: vesselData?.nda_flag ? null : (vesselData?.loa_meters ?? null),
      region: portData?.cities?.regions?.name ?? null,
      city: portData?.cities?.name ?? null,
      port: portData?.name ?? null,
      start_date: dw.start_date,
      end_date: dw.end_date,
      working_days: dw.working_days,
      day_rate: dw.day_rate,
      currency: dw.currency,
      meals: dw.meals,
      positions_available: dw.positions_available,
      permanent_opportunity: dw.permanent_opportunity,
      required_certs: (certs?.data ?? []).map((c: { name: string }) => c.name),
      required_languages: dw.required_languages ?? [],
      experience_bracket: bracket?.data?.label ?? null,
      description: null,
      notes: dw.notes,
      created_at: dw.created_at,
    };
  }

  // PM — permanent posting
  const { data: pp } = await sc
    .from('permanent_postings')
    .select(
      `id, job_number, status, start_date,
      salary_min, salary_max, salary_currency, salary_period,
      contract_type, live_aboard, shortlist_cap, notes, description,
      required_languages, positions_available,
      vessel_id, role_id, port_id,
      required_certification_ids, experience_bracket_id, created_at`,
    )
    .eq('job_number', num)
    .eq('status', 'active')
    .single();

  if (!pp) return null;

  const [role, port, bracket, vessel, certs] = await Promise.all([
    pp.role_id
      ? sc.from('yacht_roles').select('name, department').eq('id', pp.role_id).single()
      : null,
    pp.port_id
      ? sc.from('ports').select('name, cities(name, regions(name))').eq('id', pp.port_id).single()
      : null,
    pp.experience_bracket_id
      ? sc.from('experience_brackets').select('label').eq('id', pp.experience_bracket_id).single()
      : null,
    pp.vessel_id
      ? sc
          .from('vessels')
          .select('name, vessel_type, loa_meters, nda_flag, vessel_size_bands:size_band_id(label)')
          .eq('id', pp.vessel_id)
          .single()
      : null,
    pp.required_certification_ids?.length > 0
      ? sc.from('certifications').select('name').in('id', pp.required_certification_ids)
      : null,
  ]);

  const portData = port?.data as PortJoin;
  const vesselData = vessel?.data as VesselJoin;

  return {
    job_number: jobNumber,
    type: 'permanent',
    role_name: role?.data?.name ?? 'Unknown Role',
    department: role?.data?.department ?? 'deck',
    vessel_name: vesselData?.nda_flag ? 'NDA Vessel' : (vesselData?.name ?? 'Unknown Vessel'),
    vessel_type: vesselData?.vessel_type ?? 'motor',
    size_band: vesselData?.vessel_size_bands?.label ?? null,
    loa_meters: vesselData?.nda_flag ? null : (vesselData?.loa_meters ?? null),
    region: portData?.cities?.regions?.name ?? null,
    city: portData?.cities?.name ?? null,
    port: portData?.name ?? null,
    start_date: pp.start_date,
    salary_min: pp.salary_min,
    salary_max: pp.salary_max,
    salary_currency: pp.salary_currency,
    salary_period: pp.salary_period,
    contract_type: pp.contract_type,
    live_aboard: pp.live_aboard,
    shortlist_cap: pp.shortlist_cap,
    required_certs: (certs?.data ?? []).map((c: { name: string }) => c.name),
    required_languages: pp.required_languages ?? [],
    experience_bracket: bracket?.data?.label ?? null,
    description: pp.description,
    notes: pp.notes,
    created_at: pp.created_at,
  };
}
