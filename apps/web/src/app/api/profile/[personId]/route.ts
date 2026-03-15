import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

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
  const { user, supabase } = guard.value;

  const { personId } = await params;

  if (personId === user.id) {
    return NextResponse.json({ error: 'Use /api/profile for your own profile' }, { status: 400 });
  }

  // Context validation: requester must have a relationship with the target
  const hasContext = await checkRelationshipContext(supabase, user.id, personId);
  if (!hasContext) {
    return NextResponse.json(
      { error: "You don't have access to view this profile" },
      { status: 403 },
    );
  }

  // Fetch target profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      `
      person_id, display_name, identity_type, bio,
      primary_role_id, certification_ids, experience_bracket_id,
      vessel_size_exposure_ids, location_port_id,
      agency_name, role_specialization_ids,
      yacht_roles(id, name, department),
      experience_brackets(id, label),
      ports(name, cities(name, regions(name)))
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

  return NextResponse.json(await buildEmployerProfile(supabase, profile, personId));
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

  // Count past completed daywork engagements
  const { count: pastDayworkCount } = await supabase
    .from('active_engagements')
    .select('id', { count: 'exact', head: true })
    .eq('crew_person_id', personId)
    .eq('status', 'completed');

  const ports = profile.ports as {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;

  return {
    person_id: profile.person_id,
    display_name: profile.display_name,
    identity_type: 'crew',
    bio: profile.bio,
    primary_role: profile.yacht_roles,
    certifications,
    experience_bracket: profile.experience_brackets,
    vessel_size_exposure: vesselSizeExposure,
    location: ports
      ? { port: ports.name, city: ports.cities?.name, region: ports.cities?.regions?.name }
      : null,
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
    past_daywork_count: pastDayworkCount ?? 0,
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
