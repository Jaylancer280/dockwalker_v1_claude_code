import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface ApplicationRow {
  id: string;
  daywork_id: string;
  status: string;
  message: string | null;
  created_at: string;
  dayworks: {
    id: string;
    job_number: number;
    start_date: string;
    end_date: string;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    status: string;
    vessel_id: string;
    poster_person_id: string;
    yacht_roles: { id: string; name: string } | null;
    ports: {
      id: string;
      name: string;
      cities: { name: string; regions: { name: string } } | null;
    } | null;
    experience_brackets: { label: string } | null;
    permanent_opportunity: boolean;
  } | null;
}

interface PublicVesselRow {
  id: string;
  name: string;
  vessel_type: string;
  size_band_label: string | null;
  nda_flag: boolean;
}

/**
 * GET /api/daywork/applications
 * Returns the authenticated crew member's pending applications
 * (applied, viewed, shortlisted) with joined daywork details.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can view applications' }, { status: 403 });
  }

  const { data: applications, error } = await supabase
    .from('applications')
    .select(
      `
      id, daywork_id, status, message, created_at,
      dayworks(
        id, job_number, start_date, end_date, working_days,
        day_rate, currency, meals, notes, status, vessel_id, poster_person_id, positions_available, positions_filled, permanent_opportunity,
        yacht_roles(id, name),
        ports(id, name, cities(name, regions(name))),
        experience_brackets(label)
      )
    `,
    )
    .eq('crew_person_id', user.id)
    .in('status', ['applied', 'viewed', 'shortlisted'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (applications ?? []) as unknown as ApplicationRow[];

  // Hydrate vessel data via the NDA-safe RPC
  const vesselIds = [
    ...new Set(rows.map((r) => r.dayworks?.vessel_id).filter(Boolean) as string[]),
  ];

  const vesselEntries: Array<[string, PublicVesselRow | null]> = await Promise.all(
    vesselIds.map(async (vesselId): Promise<[string, PublicVesselRow | null]> => {
      const { data, error: vErr } = await supabase.rpc('get_vessel_public', {
        p_vessel_id: vesselId,
      });
      if (vErr) return [vesselId, null];
      const vessel = Array.isArray(data) ? data[0] : data;
      return vessel ? [vesselId, vessel as PublicVesselRow] : [vesselId, null];
    }),
  );

  const vesselMap = new Map<string, PublicVesselRow | null>(vesselEntries);

  // Resolve poster display names
  const posterIds = [
    ...new Set(rows.map((r) => r.dayworks?.poster_person_id).filter(Boolean) as string[]),
  ];
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

  const hydrated = rows.map((app) => {
    const vessel = app.dayworks?.vessel_id ? vesselMap.get(app.dayworks.vessel_id) : null;
    const posterId = app.dayworks?.poster_person_id ?? null;
    return {
      id: app.id,
      daywork_id: app.daywork_id,
      status: app.status,
      message: app.message,
      applied_at: app.created_at,
      daywork: app.dayworks
        ? {
            job_number: app.dayworks.job_number,
            start_date: app.dayworks.start_date,
            end_date: app.dayworks.end_date,
            working_days: app.dayworks.working_days,
            day_rate: app.dayworks.day_rate,
            currency: app.dayworks.currency,
            meals: app.dayworks.meals,
            notes: app.dayworks.notes,
            daywork_status: app.dayworks.status,
            poster_person_id: posterId,
            poster_name: posterId ? (posterNameMap.get(posterId) ?? null) : null,
            role_name: app.dayworks.yacht_roles?.name ?? null,
            port_name: app.dayworks.ports?.name ?? null,
            city_name: app.dayworks.ports?.cities?.name ?? null,
            region_name: app.dayworks.ports?.cities?.regions?.name ?? null,
            experience_label: app.dayworks.experience_brackets?.label ?? null,
            vessel_name: vessel?.nda_flag ? 'NDA Vessel' : (vessel?.name ?? null),
            vessel_type: vessel?.vessel_type ?? null,
            vessel_size_label: vessel?.size_band_label ?? null,
            permanent_opportunity: app.dayworks?.permanent_opportunity ?? false,
          }
        : null,
    };
  });

  return NextResponse.json({ applications: hydrated });
}
