import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface PublicVesselRow {
  id: string;
  imo_number: string | null;
  name: string;
  vessel_type: string;
  size_band_id: string;
  size_band_label: string | null;
  nda_flag: boolean;
  loa_meters: number | null;
  owner_person_id: string;
}

const BATCH_SIZE = 20;

/**
 * GET /api/permanent/discover
 * Returns active/in_negotiation permanent postings for crew discovery.
 * Excludes postings the crew has already interacted with and own postings.
 * Ordered by recency (newest first). Cursor-based pagination.
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    const isAgent = person.identity_type === 'agent';
    if (person.current_hat !== 'crew' && !isAgent) {
      return NextResponse.json(
        { error: 'Only crew can discover permanent positions' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const filterRoleId = searchParams.get('roleId');
    const filterPortId = searchParams.get('portId');
    const filterCertificationId = searchParams.get('certificationId');
    const filterExperienceBracketId = searchParams.get('experienceBracketId');
    const filterSalaryMin = searchParams.get('salaryMin');
    const filterLiveAboard = searchParams.get('liveAboard');
    const filterSizeBandId = searchParams.get('sizeBandId');
    const cursor = searchParams.get('cursor');

    // Get IDs of permanent postings this crew has already interacted with
    const { data: existingApps } = await supabase
      .from('applications')
      .select('permanent_posting_id')
      .eq('crew_person_id', user.id)
      .not('permanent_posting_id', 'is', null)
      .in('status', [
        'applied',
        'shortlisted',
        'selected',
        'withdrawn',
        'not_selected',
        'rejected',
      ]);

    const excludedIds = (existingApps ?? [])
      .map((a) => a.permanent_posting_id as string)
      .filter(Boolean);

    // Build query
    let query = supabase
      .from('permanent_postings')
      .select(
        `
        id, job_number, vessel_id, role_id, port_id, start_date,
        salary_min, salary_max, salary_currency, salary_period,
        live_aboard, required_certification_ids, required_languages, experience_bracket_id,
        shortlist_cap, notes, contract_type, contract_details, description, meals,
        positions_available, status, created_at, employer_person_id,
        yacht_roles(id, name, department),
        ports(id, name, cities(name, regions(name))),
        experience_brackets(label)
      `,
      )
      .in('status', ['active', 'in_negotiation'])
      .neq('employer_person_id', user.id);

    if (excludedIds.length > 0) {
      query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    // Apply filters
    if (filterRoleId) {
      query = query.eq('role_id', filterRoleId);
    }
    if (filterPortId) {
      query = query.eq('port_id', filterPortId);
    }
    if (filterCertificationId) {
      if (filterCertificationId === 'none') {
        query = query.eq('required_certification_ids', '{}');
      } else {
        query = query.contains('required_certification_ids', [filterCertificationId]);
      }
    }
    if (filterExperienceBracketId) {
      query = query.eq('experience_bracket_id', filterExperienceBracketId);
    }
    if (filterSalaryMin) {
      const minSalary = parseFloat(filterSalaryMin);
      if (!isNaN(minSalary) && minSalary > 0) {
        query = query.gte('salary_max', minSalary);
      }
    }
    if (filterLiveAboard && filterLiveAboard !== 'any') {
      query = query.eq('live_aboard', filterLiveAboard === 'true' || filterLiveAboard === 'yes');
    }
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    query = query.order('created_at', { ascending: false });

    const fetchLimit = filterSizeBandId ? BATCH_SIZE * 10 : BATCH_SIZE;
    const { data: postings, error } = await query.limit(fetchLimit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (postings ?? []) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return NextResponse.json({ postings: [], has_more: false, next_cursor: null });
    }

    // Hydrate vessel data (single batch query instead of N+1)
    const vesselIds = [...new Set(rows.map((r) => r.vessel_id as string).filter(Boolean))];
    const vesselMap = new Map<string, PublicVesselRow | null>();
    if (vesselIds.length > 0) {
      const { data: vessels } = await supabase.rpc('get_vessels_public_batch', {
        p_vessel_ids: vesselIds,
      });
      for (const v of (vessels ?? []) as PublicVesselRow[]) {
        vesselMap.set(v.id, v);
      }
    }

    // Resolve poster display names
    const posterIds = [...new Set(rows.map((r) => r.employer_person_id as string))];
    const posterNameMap = new Map<string, string>();
    if (posterIds.length > 0) {
      const { data: posterProfiles } = await supabase
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', posterIds);
      for (const p of posterProfiles ?? []) {
        posterNameMap.set(p.person_id, p.display_name);
      }
    }

    // Resolve cert names
    const allCertIds = [
      ...new Set(rows.flatMap((r) => (r.required_certification_ids as string[]) ?? [])),
    ];
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

    // Hydrate response
    let hydrated = rows.map((posting) => {
      const vessel = vesselMap.get(posting.vessel_id as string);
      const role = posting.yacht_roles as { id: string; name: string; department: string } | null;
      const port = posting.ports as {
        id: string;
        name: string;
        cities: { name: string; regions: { name: string } } | null;
      } | null;
      const expBracket = posting.experience_brackets as { label: string } | null;
      const certIds = (posting.required_certification_ids as string[]) ?? [];

      return {
        id: posting.id,
        job_number: posting.job_number,
        start_date: posting.start_date,
        salary_min: posting.salary_min,
        salary_max: posting.salary_max,
        salary_currency: posting.salary_currency,
        salary_period: posting.salary_period,
        live_aboard: posting.live_aboard,
        shortlist_cap: posting.shortlist_cap,
        notes: posting.notes,
        status: posting.status,
        created_at: posting.created_at,
        required_certification_ids: certIds,
        required_languages: (posting.required_languages as string[]) ?? [],
        experience_bracket_id: posting.experience_bracket_id,
        role_name: role?.name ?? null,
        role_department: role?.department ?? null,
        port_name: port?.name ?? null,
        city_name: port?.cities?.name ?? null,
        region_name: port?.cities?.regions?.name ?? null,
        vessel_name: vessel?.name ?? null,
        vessel_nda: vessel?.nda_flag ?? false,
        vessel_type: vessel?.vessel_type ?? null,
        vessel_size_label: vessel?.size_band_label ?? null,
        vessel_size_band_id: vessel?.size_band_id ?? null,
        vessel_loa: vessel?.loa_meters ?? null,
        experience_label: expBracket?.label ?? null,
        cert_names: certIds.map((id) => certNameMap.get(id) ?? id),
        poster_name: posterNameMap.get(posting.employer_person_id as string) ?? null,
        poster_person_id: posting.employer_person_id,
      };
    });

    // Post-fetch filter: sizeBandId
    if (filterSizeBandId) {
      hydrated = hydrated.filter((p) => p.vessel_size_band_id === filterSizeBandId);
    }

    const hasMore = filterSizeBandId ? hydrated.length > BATCH_SIZE : rows.length === BATCH_SIZE;
    if (filterSizeBandId && hydrated.length > BATCH_SIZE) {
      hydrated = hydrated.slice(0, BATCH_SIZE);
    }
    const nextCursor =
      hasMore && hydrated.length > 0 ? (hydrated[hydrated.length - 1].created_at as string) : null;

    // Strip poster identity for agents
    const results = isAgent
      ? hydrated.map((p) => ({
          ...p,
          poster_person_id: null as string | null,
          poster_name: null as string | null,
        }))
      : hydrated;

    return NextResponse.json({ postings: results, has_more: hasMore, next_cursor: nextCursor });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
