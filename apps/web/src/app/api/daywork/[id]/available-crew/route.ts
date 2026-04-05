import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/:id/available-crew
 * Returns crew with matching availability who haven't applied or been invited.
 * Employer/agent only (must own the posting).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'employer' && person.current_hat !== 'agent') {
      return NextResponse.json({ error: 'Employer or agent role required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const allRoles = url.searchParams.get('allRoles') === 'true';

    // Fetch daywork with role_id and location
    const { data: daywork } = await supabase
      .from('dayworks')
      .select(
        'id, poster_person_id, start_date, end_date, role_id, location_port_id, status, positions_available',
      )
      .eq('id', dayworkId)
      .single();

    if (!daywork) {
      return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
    }

    if (daywork.poster_person_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
    }

    const invitationLimit = (daywork.positions_available ?? 1) + 2;

    if (daywork.status !== 'active') {
      return NextResponse.json({
        crew: [],
        invitation_count: 0,
        invitation_limit: invitationLimit,
      });
    }

    // Resolve port → city
    const { data: port } = await supabase
      .from('ports')
      .select('city_id')
      .eq('id', daywork.location_port_id)
      .single();

    if (!port) {
      return NextResponse.json({
        crew: [],
        invitation_count: 0,
        invitation_limit: invitationLimit,
      });
    }

    const cityId = port.city_id;

    // Find crew with non-expired availability in matching city, within daywork date range
    const { data: availWindows } = await supabase
      .from('availability_windows')
      .select('person_id, date, city_id, not_available')
      .eq('city_id', cityId)
      .eq('not_available', false)
      .gte('date', daywork.start_date)
      .lte('date', daywork.end_date)
      .gt('expires_at', new Date().toISOString());

    if (!availWindows || availWindows.length === 0) {
      // Count existing invitations even if no crew available
      const { count: invCount } = await supabase
        .from('daywork_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('daywork_id', dayworkId)
        .eq('status', 'pending');

      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Aggregate available days per person
    const availMap: Record<string, number> = {};
    for (const w of availWindows) {
      availMap[w.person_id] = (availMap[w.person_id] ?? 0) + 1;
    }

    const candidateIds = Object.keys(availMap);

    // Exclude: employer themselves
    const filteredIds = candidateIds.filter((id) => id !== user.id);

    if (filteredIds.length === 0) {
      const { count: invCount } = await supabase
        .from('daywork_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('daywork_id', dayworkId)
        .eq('status', 'pending');

      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Exclude: crew who already applied, crew already invited
    const [{ data: existingApps }, { data: existingInvitations }] = await Promise.all([
      supabase
        .from('applications')
        .select('crew_person_id')
        .eq('daywork_id', dayworkId)
        .in('crew_person_id', filteredIds),
      supabase
        .from('daywork_invitations')
        .select('crew_person_id')
        .eq('daywork_id', dayworkId)
        .in('crew_person_id', filteredIds),
    ]);

    const appliedSet = new Set((existingApps ?? []).map((a) => a.crew_person_id));
    const invitedSet = new Set((existingInvitations ?? []).map((i) => i.crew_person_id));

    const eligibleIds = filteredIds.filter((id) => !appliedSet.has(id) && !invitedSet.has(id));

    // Gate: only Crew Pro subscribers appear in available crew tab
    let proEligibleIds = eligibleIds;
    if (eligibleIds.length > 0) {
      const { data: proSubs } = await serviceClient
        .from('subscriptions')
        .select('person_id')
        .in('person_id', eligibleIds)
        .eq('plan', 'crew_pro')
        .in('status', ['active', 'trialing']);

      const proSet = new Set((proSubs ?? []).map((s: { person_id: string }) => s.person_id));
      proEligibleIds = eligibleIds.filter((id) => proSet.has(id));
    }

    // Get pending invitation count for this daywork
    const { count: invCount } = await supabase
      .from('daywork_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('daywork_id', dayworkId)
      .eq('status', 'pending');

    if (proEligibleIds.length === 0) {
      return NextResponse.json({
        crew: [],
        invitation_count: invCount ?? 0,
        invitation_limit: invitationLimit,
      });
    }

    // Fetch profiles for eligible Pro crew
    const { data: profiles } = await supabase
      .from('profiles')
      .select(
        `
      person_id, display_name, avatar_url, primary_role_id, certification_ids, languages,
      experience_bracket_id, vessel_size_exposure_ids, bio, location_port_id,
      yacht_roles:primary_role_id(id, name, department),
      experience_brackets:experience_bracket_id(label),
      ports:location_port_id(name, cities(name, regions(name))),
      nationalities:nationality_id(name, flag_emoji)
    `,
      )
      .in('person_id', proEligibleIds);

    // Apply role filter (default: match daywork's role_id)
    let matchedProfiles = profiles ?? [];
    if (!allRoles) {
      matchedProfiles = matchedProfiles.filter((p) => p.primary_role_id === daywork.role_id);
    }

    // Build enriched crew list
    const crew = matchedProfiles
      .map((p) => ({
        person_id: p.person_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        primary_role_id: p.primary_role_id,
        certification_ids: p.certification_ids,
        experience_bracket_id: p.experience_bracket_id,
        vessel_size_exposure_ids: p.vessel_size_exposure_ids,
        bio: p.bio,
        location_port_id: p.location_port_id,
        yacht_roles: p.yacht_roles,
        experience_brackets: p.experience_brackets,
        ports: p.ports,
        available_days: availMap[p.person_id] ?? 0,
      }))
      .sort((a, b) => b.available_days - a.available_days)
      .slice(0, 50);

    return NextResponse.json({
      crew,
      invitation_count: invCount ?? 0,
      invitation_limit: invitationLimit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
