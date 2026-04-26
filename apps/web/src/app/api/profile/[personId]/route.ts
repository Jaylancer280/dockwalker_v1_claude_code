import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { resolveHistoricalVesselNames } from '@/lib/vessels/historical-names';

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
    const { user, supabase, serviceClient } = guard.value;

    const { personId } = await params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(personId)) {
      return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
    }

    const isSelfView = personId === user.id;

    if (!isSelfView) {
      // Context validation: requester must have a relationship with the target
      // Use serviceClient: RLS on applications silently filters rows for agent-hat posters
      const hasContext = await checkRelationshipContext(serviceClient, user.id, personId);
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
      vessel_size_exposure_ids, location_port_id, location_city_id,
      nationality_id, nationality_ids, entry_right_ids,
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

    // Resolve multi-nationality batch lookup. The PostgREST single embed
    // above only covers the legacy nationality_id; for the array we
    // attach `nationalities_all` so the client renders multiple flags.
    const nationalityIds = ((profile as { nationality_ids?: string[] }).nationality_ids ??
      []) as string[];
    let nationalitiesAll: { id: string; name: string; flag_emoji: string }[] = [];
    if (nationalityIds.length > 0) {
      const { data: natRows } = await supabase
        .from('nationalities')
        .select('id, name, flag_emoji')
        .in('id', nationalityIds);
      nationalitiesAll = (natRows as typeof nationalitiesAll) ?? [];
    }
    const profileWithNats = { ...profile, nationalities_all: nationalitiesAll };

    if (profile.identity_type === 'crew') {
      return NextResponse.json(await buildCrewProfile(supabase, profileWithNats, personId));
    }

    if (profile.identity_type === 'agent') {
      return NextResponse.json(await buildAgentProfile(supabase, profileWithNats, personId));
    }

    return NextResponse.json(await buildEmployerProfile(supabase, profileWithNats, personId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function checkRelationshipContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  requesterId: string,
  targetId: string,
): Promise<boolean> {
  // 1. Engagement context (either party)
  const { data: engagement } = await client
    .from('active_engagements')
    .select('id')
    .or(
      `and(crew_person_id.eq.${requesterId},employer_person_id.eq.${targetId}),and(crew_person_id.eq.${targetId},employer_person_id.eq.${requesterId})`,
    )
    .limit(1);

  if (engagement && engagement.length > 0) return true;

  // 2. Application context: requester's postings have applications from target, or target's postings have applications from requester
  const { data: appContext } = await client
    .from('applications')
    .select('id, dayworks!inner(poster_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},dayworks.poster_person_id.eq.${requesterId}),and(crew_person_id.eq.${requesterId},dayworks.poster_person_id.eq.${targetId})`,
    )
    .not('status', 'eq', 'withdrawn')
    .limit(1);

  if (appContext && appContext.length > 0) return true;

  // 3. Invitation context
  const { data: invContext } = await client
    .from('daywork_invitations')
    .select('id, dayworks!inner(poster_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},dayworks.poster_person_id.eq.${requesterId}),and(crew_person_id.eq.${requesterId},dayworks.poster_person_id.eq.${targetId})`,
    )
    .limit(1);

  if (invContext && invContext.length > 0) return true;

  // 4. Permanent application context — split into two explicit steps
  //    to avoid PostgREST `or()` + embedded-table filter quirks that
  //    silently miss matches in production. We fetch any permanent
  //    application involving either party, then resolve the posting's
  //    employer in JS and check the cross-pair match.
  const { data: permApps } = await client
    .from('applications')
    .select('id, permanent_posting_id, crew_person_id, status')
    .or(`crew_person_id.eq.${requesterId},crew_person_id.eq.${targetId}`)
    .not('status', 'eq', 'withdrawn')
    .not('permanent_posting_id', 'is', null);

  if (permApps && permApps.length > 0) {
    const postingIds = permApps
      .map((a: { permanent_posting_id: string | null }) => a.permanent_posting_id)
      .filter((id: string | null): id is string => Boolean(id));
    const { data: postings } = await client
      .from('permanent_postings')
      .select('id, employer_person_id')
      .in('id', postingIds);

    const postingMap = new Map<string, string>();
    for (const p of (postings as { id: string; employer_person_id: string }[]) ?? []) {
      postingMap.set(p.id, p.employer_person_id);
    }

    for (const app of permApps as {
      crew_person_id: string;
      permanent_posting_id: string | null;
    }[]) {
      if (!app.permanent_posting_id) continue;
      const employer = postingMap.get(app.permanent_posting_id);
      if (!employer) continue;
      // target applied to requester's posting
      if (app.crew_person_id === targetId && employer === requesterId) return true;
      // requester applied to target's posting
      if (app.crew_person_id === requesterId && employer === targetId) return true;
    }
  }

  // 5. Active poster context — target has an active daywork or permanent posting
  const { data: activeDaywork } = await client
    .from('dayworks')
    .select('id')
    .eq('poster_person_id', targetId)
    .eq('status', 'active')
    .limit(1);

  if (activeDaywork && activeDaywork.length > 0) return true;

  const { data: activePerm } = await client
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
      id, vessel_id, start_date, end_date, is_current, vessel_operation,
      flag_state, contract_type, contract_details, description,
      vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
      yacht_roles(name)
    `,
    )
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  const experienceRows = (experiences ?? []) as Array<
    {
      vessel_id: string | null;
      start_date: string;
      vessels: { name: string } | null;
    } & Record<string, unknown>
  >;
  const historicalMap = await resolveHistoricalVesselNames(
    supabase,
    experienceRows
      .filter((r) => r.vessel_id)
      .map((r) => ({ vessel_id: r.vessel_id as string, start_date: r.start_date })),
  );

  // Fetch shore-based experiences
  const { data: shoreExperiences } = await supabase
    .from('shore_experiences')
    .select(
      `id, employer_name, job_title, start_date, end_date, is_current, description,
       shore_experience_categories(id, name)`,
    )
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  // Resolve entry-right names
  let entryRights: { id: string; name: string; category: string }[] = [];
  if (profile.entry_right_ids?.length > 0) {
    const { data } = await supabase
      .from('entry_rights')
      .select('id, name, category')
      .in('id', profile.entry_right_ids);
    entryRights = data ?? [];
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
    entry_rights: entryRights,
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
    experiences: experienceRows.map((exp) => {
      const vessel = exp.vessels as {
        name: string;
        vessel_type: string;
        loa_meters: number;
        vessel_size_bands: { label: string } | null;
      } | null;
      const historical = exp.vessel_id
        ? (historicalMap.get(`${exp.vessel_id}|${exp.start_date}`) ?? null)
        : null;
      const current = vessel?.name ?? null;
      return {
        vessel_name: current,
        historical_vessel_name: historical && historical !== current ? historical : null,
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
    shore_experiences: (shoreExperiences ?? []).map((se: Record<string, unknown>) => {
      const cat = se.shore_experience_categories as { id: string; name: string } | null;
      return {
        id: se.id,
        category_name: cat?.name ?? null,
        employer_name: se.employer_name,
        job_title: se.job_title,
        start_date: se.start_date,
        end_date: se.end_date,
        is_current: se.is_current,
        description: se.description,
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
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    deck_name: profile.deck_name ?? null,
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
      id, vessel_id, start_date, end_date, is_current, vessel_operation,
      flag_state, contract_type, contract_details, description,
      vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
      yacht_roles(name)
    `,
    )
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  const experienceRows = (experiences ?? []) as Array<
    {
      vessel_id: string | null;
      start_date: string;
      vessels: { name: string } | null;
    } & Record<string, unknown>
  >;
  const historicalMap = await resolveHistoricalVesselNames(
    supabase,
    experienceRows
      .filter((r) => r.vessel_id)
      .map((r) => ({ vessel_id: r.vessel_id as string, start_date: r.start_date })),
  );

  return {
    ...employerData,
    maritime_background: experienceRows.map((exp) => {
      const vessel = exp.vessels as {
        name: string;
        vessel_type: string;
        loa_meters: number;
        vessel_size_bands: { label: string } | null;
      } | null;
      const historical = exp.vessel_id
        ? (historicalMap.get(`${exp.vessel_id}|${exp.start_date}`) ?? null)
        : null;
      const current = vessel?.name ?? null;
      return {
        vessel_name: current,
        historical_vessel_name: historical && historical !== current ? historical : null,
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
