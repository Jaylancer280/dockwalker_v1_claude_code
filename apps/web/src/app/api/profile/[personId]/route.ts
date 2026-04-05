import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/profile/[personId]
 * View another user's profile in context. Requires a legitimate relationship
 * (application, invitation, or engagement) between requester and target.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { personId } = await params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(personId)) {
      return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
    }

    const isSelfView = personId === user.id;

    if (!isSelfView) {
      // Context validation: requester must have a relationship with the target
      const hasContext = await checkRelationshipContext(supabase, user.id, personId);
      if (!hasContext) {
        return NextResponse.json(
          { error: "You don't have access to view this profile" },
          { status: 403 },
        );
      }
    }

    // Fetch target profile
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        `
      person_id, display_name, identity_type, bio, avatar_url, deck_name,
      primary_role_id, desired_role_id, certification_ids, experience_bracket_id,
      vessel_size_exposure_ids, location_port_id, location_city_id, nationality_id, visa_ids,
      languages, permanent_availability, notice_period_days,
      smoker, visible_tattoos,
      agency_name, role_specialization_ids,
      yacht_roles!profiles_primary_role_id_fkey(id, name, department),
      desired_roles:yacht_roles!profiles_desired_role_id_fkey(id, name),
      experience_brackets(id, label),
      ports(name, cities(name, regions(name))),
      location_cities:cities!profiles_location_city_id_fkey(id, name, regions(name)),
      nationalities(id, name, country_code, flag_emoji)
    `,
      )
      .eq('person_id', personId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.identity_type === 'crew') {
      return NextResponse.json(await buildCrewProfile(supabase, profile, personId));
    }

    if (profile.identity_type === 'agent') {
      return NextResponse.json(await buildAgentProfile(supabase, profile, personId));
    }

    return NextResponse.json(await buildEmployerProfile(supabase, profile, personId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function checkRelationshipContext(
  supabase: ReturnType<typeof requireDomainUser> extends Promise<infer R>
    ? R extends { ok: true; value: { supabase: infer S } }
      ? S
      : never
    : never,
  requesterId: string,
  targetId: string,
): Promise<boolean> {
  // 1. Engagement context (either party)
  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id')
    .or(
      `and(crew_person_id.eq.${requesterId},employer_person_id.eq.${targetId}),and(crew_person_id.eq.${targetId},employer_person_id.eq.${requesterId})`,
    )
    .limit(1);

  if (engagement && engagement.length > 0) return true;

  // 2. Application context: requester's postings have applications from target, or target's postings have applications from requester
  const { data: appContext } = await supabase
    .from('applications')
    .select('id, dayworks!inner(poster_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},dayworks.poster_person_id.eq.${requesterId}),and(crew_person_id.eq.${requesterId},dayworks.poster_person_id.eq.${targetId})`,
    )
    .not('status', 'eq', 'withdrawn')
    .limit(1);

  if (appContext && appContext.length > 0) return true;

  // 3. Invitation context
  const { data: invContext } = await supabase
    .from('daywork_invitations')
    .select('id, dayworks!inner(poster_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},dayworks.poster_person_id.eq.${requesterId}),and(crew_person_id.eq.${requesterId},dayworks.poster_person_id.eq.${targetId})`,
    )
    .limit(1);

  if (invContext && invContext.length > 0) return true;

  // 4. Permanent application context
  const { data: permAppContext } = await supabase
    .from('applications')
    .select('id, permanent_postings!inner(employer_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},permanent_postings.employer_person_id.eq.${requesterId}),` +
        `and(crew_person_id.eq.${requesterId},permanent_postings.employer_person_id.eq.${targetId})`,
    )
    .not('status', 'eq', 'withdrawn')
    .limit(1);

  if (permAppContext && permAppContext.length > 0) return true;

  // 5. Active poster context — target has an active daywork or permanent posting
  // Use service client to bypass RLS — poster visibility shouldn't depend on viewer's permissions
  const serviceClient = await createServiceClient();

  const { data: activeDaywork } = await serviceClient
    .from('dayworks')
    .select('id')
    .eq('poster_person_id', targetId)
    .eq('status', 'active')
    .limit(1);

  if (activeDaywork && activeDaywork.length > 0) return true;

  const { data: activePerm } = await serviceClient
    .from('permanent_postings')
    .select('id')
    .eq('employer_person_id', targetId)
    .in('status', ['active', 'in_negotiation'])
    .limit(1);

  if (activePerm && activePerm.length > 0) return true;

  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildCrewProfile(supabase: any, profile: any, personId: string) {
  // Resolve certification names
  let certifications: { id: string; name: string }[] = [];
  if (profile.certification_ids?.length > 0) {
    const { data } = await supabase
      .from('certifications')
      .select('id, name')
      .in('id', profile.certification_ids);
    certifications = data ?? [];
  }

  // Resolve vessel size exposure labels
  let vesselSizeExposure: { id: string; label: string }[] = [];
  if (profile.vessel_size_exposure_ids?.length > 0) {
    const { data } = await supabase
      .from('vessel_size_bands')
      .select('id, label')
      .in('id', profile.vessel_size_exposure_ids);
    vesselSizeExposure = data ?? [];
  }

  // Fetch experiences (no salary fields)
  const { data: experiences } = await supabase
    .from('crew_experiences')
    .select(
      `
      id, start_date, end_date, is_current, vessel_operation,
      flag_state, contract_type, contract_details, description,
      vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
      yacht_roles(name)
    `,
    )
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  // Resolve visa names
  let visas: { id: string; name: string }[] = [];
  if (profile.visa_ids?.length > 0) {
    const { data } = await supabase
      .from('visa_types')
      .select('id, name')
      .in('id', profile.visa_ids);
    visas = data ?? [];
  }

  const ports = profile.ports as {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;

  const locationCity = profile.location_cities as {
    id: string;
    name: string;
    regions: { name: string };
  } | null;

  // Derive city from port if location_city_id is not set
  const cityName = locationCity?.name ?? ports?.cities?.name ?? null;
  const regionName = locationCity?.regions?.name ?? ports?.cities?.regions?.name ?? null;

  return {
    person_id: profile.person_id,
    display_name: profile.display_name,
    identity_type: 'crew',
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    deck_name: profile.deck_name ?? null,
    primary_role: profile.yacht_roles,
    desired_role: profile.desired_roles ?? null,
    nationality: profile.nationalities ?? null,
    visas,
    languages: profile.languages ?? [],
    certifications,
    experience_bracket: profile.experience_brackets,
    vessel_size_exposure: vesselSizeExposure,
    location: ports
      ? { port: ports.name, city: ports.cities?.name, region: ports.cities?.regions?.name }
      : null,
    city_location: cityName ? { city: cityName, region: regionName } : null,
    permanent_availability: profile.permanent_availability ?? null,
    notice_period_days: profile.notice_period_days ?? null,
    smoker: profile.smoker ?? null,
    visible_tattoos: profile.visible_tattoos ?? null,
    experiences: (experiences ?? []).map((exp: Record<string, unknown>) => {
      const vessel = exp.vessels as {
        name: string;
        vessel_type: string;
        loa_meters: number;
        vessel_size_bands: { label: string } | null;
      } | null;
      return {
        vessel_name: vessel?.name ?? null,
        vessel_type: vessel?.vessel_type ?? null,
        vessel_loa_meters: vessel?.loa_meters ?? null,
        vessel_size_band: vessel?.vessel_size_bands?.label ?? null,
        role: (exp.yacht_roles as { name: string } | null)?.name ?? null,
        start_date: exp.start_date,
        end_date: exp.end_date,
        is_current: exp.is_current,
        vessel_operation: exp.vessel_operation,
        flag_state: exp.flag_state,
        contract_type: exp.contract_type,
        contract_details: exp.contract_details,
        description: exp.description,
      };
    }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildEmployerProfile(supabase: any, profile: any, personId: string) {
  // Resolve role specialization names
  let roleSpecializations: { id: string; name: string }[] = [];
  if (profile.role_specialization_ids?.length > 0) {
    const { data } = await supabase
      .from('yacht_roles')
      .select('id, name')
      .in('id', profile.role_specialization_ids);
    roleSpecializations = data ?? [];
  }

  // Fetch non-NDA vessels
  const { data: vessels } = await supabase
    .from('vessels')
    .select('name, vessel_type, loa_meters, vessel_size_bands(label)')
    .eq('owner_person_id', personId)
    .eq('nda_flag', false);

  // Count active postings
  const { count: activePostingCount } = await supabase
    .from('dayworks')
    .select('id', { count: 'exact', head: true })
    .eq('poster_person_id', personId)
    .eq('status', 'active');

  const ports = profile.ports as {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;

  return {
    person_id: profile.person_id,
    display_name: profile.display_name,
    identity_type: profile.identity_type,
    agency_name: profile.agency_name,
    role_specializations: roleSpecializations,
    location: ports
      ? { port: ports.name, city: ports.cities?.name, region: ports.cities?.regions?.name }
      : null,
    vessels: (vessels ?? []).map((v: Record<string, unknown>) => ({
      name: v.name,
      vessel_type: v.vessel_type,
      loa_meters: v.loa_meters,
      size_band: (v.vessel_size_bands as { label: string } | null)?.label ?? null,
    })),
    active_posting_count: activePostingCount ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAgentProfile(supabase: any, profile: any, personId: string) {
  // Get employer-level data
  const employerData = await buildEmployerProfile(supabase, profile, personId);

  // Also fetch maritime background (experiences) — same query as crew
  const { data: experiences } = await supabase
    .from('crew_experiences')
    .select(
      `
      id, start_date, end_date, is_current, vessel_operation,
      flag_state, contract_type, contract_details, description,
      vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
      yacht_roles(name)
    `,
    )
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  return {
    ...employerData,
    maritime_background: (experiences ?? []).map((exp: Record<string, unknown>) => {
      const vessel = exp.vessels as {
        name: string;
        vessel_type: string;
        loa_meters: number;
        vessel_size_bands: { label: string } | null;
      } | null;
      return {
        vessel_name: vessel?.name ?? null,
        vessel_type: vessel?.vessel_type ?? null,
        vessel_loa_meters: vessel?.loa_meters ?? null,
        vessel_size_band: vessel?.vessel_size_bands?.label ?? null,
        role: (exp.yacht_roles as { name: string } | null)?.name ?? null,
        start_date: exp.start_date,
        end_date: exp.end_date,
        flag_state: exp.flag_state,
        contract_type: exp.contract_type,
      };
    }),
  };
}
