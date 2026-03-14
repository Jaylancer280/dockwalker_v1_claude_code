import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface PublicVesselRow {
  id: string;
  name: string;
  vessel_type: string;
  size_band_label: string | null;
  nda_flag: boolean;
}

/**
 * GET /api/daywork/invitations
 * Returns pending invitations for the authenticated crew member,
 * hydrated with daywork details and employer display name.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can view invitations' }, { status: 403 });
  }

  const { data: invitations, error } = await supabase
    .from('daywork_invitations')
    .select('id, daywork_id, employer_person_id, status, created_at')
    .eq('crew_person_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invitations || invitations.length === 0) {
    return NextResponse.json({ invitations: [] });
  }

  // Gather unique daywork IDs and employer IDs for batch lookups
  const dayworkIds = [...new Set(invitations.map((i) => i.daywork_id))];
  const employerIds = [...new Set(invitations.map((i) => i.employer_person_id))];

  // Fetch daywork details
  const { data: dayworks } = await supabase
    .from('dayworks')
    .select(
      `
      id, job_number, start_date, end_date, working_days,
      day_rate, currency, meals, notes, status, vessel_id,
      yacht_roles(id, name),
      ports(id, name, cities(name, regions(name))),
      experience_brackets(label)
    `,
    )
    .in('id', dayworkIds);

  const dayworkMap = new Map<string, Record<string, unknown>>();
  for (const dw of dayworks ?? []) {
    dayworkMap.set(dw.id, dw as unknown as Record<string, unknown>);
  }

  // Fetch employer display names
  const { data: employers } = await supabase
    .from('profiles')
    .select('person_id, display_name')
    .in('person_id', employerIds);

  const employerMap = new Map<string, string>();
  for (const e of employers ?? []) {
    employerMap.set(e.person_id, e.display_name);
  }

  // Fetch vessel data via NDA-safe RPC
  const vesselIds = [
    ...new Set(
      (dayworks ?? [])
        .map((dw) => (dw as unknown as { vessel_id: string }).vessel_id)
        .filter(Boolean),
    ),
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

  // Filter out invitations where the daywork start date has already passed
  const today = new Date().toISOString().slice(0, 10);
  const validInvitations = invitations.filter((inv) => {
    const dw = dayworkMap.get(inv.daywork_id) as Record<string, unknown> | undefined;
    if (!dw) return true; // keep if daywork not found (will show null daywork)
    const startDate = dw.start_date as string | null;
    return !startDate || startDate >= today;
  });

  // Hydrate invitations
  const hydrated = validInvitations.map((inv) => {
    const dw = dayworkMap.get(inv.daywork_id) as Record<string, unknown> | undefined;
    const vesselId = dw?.vessel_id as string | undefined;
    const vessel = vesselId ? vesselMap.get(vesselId) : null;
    const roles = dw?.yacht_roles as { id: string; name: string } | null;
    const ports = dw?.ports as {
      id: string;
      name: string;
      cities: { name: string; regions: { name: string } } | null;
    } | null;
    const brackets = dw?.experience_brackets as { label: string } | null;

    return {
      id: inv.id,
      daywork_id: inv.daywork_id,
      employer_name: employerMap.get(inv.employer_person_id) ?? null,
      created_at: inv.created_at,
      daywork: dw
        ? {
            job_number: dw.job_number as number,
            start_date: dw.start_date as string,
            end_date: dw.end_date as string,
            working_days: dw.working_days as number,
            day_rate: dw.day_rate as number,
            currency: dw.currency as string,
            meals: dw.meals as string[],
            notes: dw.notes as string | null,
            daywork_status: dw.status as string,
            role_name: roles?.name ?? null,
            port_name: ports?.name ?? null,
            city_name: ports?.cities?.name ?? null,
            region_name: ports?.cities?.regions?.name ?? null,
            experience_label: brackets?.label ?? null,
            vessel_name: vessel?.nda_flag ? 'NDA Vessel' : (vessel?.name ?? null),
            vessel_type: vessel?.vessel_type ?? null,
            vessel_size_label: vessel?.size_band_label ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ invitations: hydrated });
}
