import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { meetsRequirements, computeTotalExperience, type BundleMap } from '@dockwalker/shared';

/**
 * GET /api/permanent/:id/review
 * Returns applicants for a permanent posting with profile data.
 * Employer/agent only, ownership-gated.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can review applicants' }, { status: 403 });
  }

  try {
    // Fetch posting
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status, shortlist_cap, required_certification_ids')
      .eq('id', postingId)
      .single();

    if (!posting) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Not your posting' }, { status: 403 });
    }

    // Fetch applications with profile joins
    // Use serviceClient: ownership is already verified above, RLS subquery on
    // permanent_postings can silently filter applications for agent-hat posters.
    const { data: applications, error } = await serviceClient
      .from('applications')
      .select(
        `
        id, crew_person_id, status, message, created_at, source, invited_from_id,
        profiles!applications_crew_person_id_profiles_fkey(
          display_name, bio, avatar_url,
          primary_role_id, certification_ids, languages, experience_bracket_id,
          vessel_size_exposure_ids, nationality_id, nationality_ids, entry_right_ids,
          permanent_availability, notice_period_days, currently_employed,
          yacht_roles:primary_role_id(name, department),
          experience_brackets:experience_bracket_id(label),
          ports:location_port_id(name, cities(name, regions(name))),
          nationalities:nationality_id(name, country_code, flag_emoji)
        )
      `,
      )
      .eq('permanent_posting_id', postingId)
      .in('status', ['applied', 'shortlisted', 'selected'])
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (applications ?? []) as any[];

    const shortlistCount = rows.filter(
      (a) => a.status === 'shortlisted' || a.status === 'selected',
    ).length;
    const selectedCrew = rows.find((a) => a.status === 'selected');

    // Per-applicant enrichment: shore experiences, sea-time totals, cert
    // match — fetched in parallel, indexed by person_id.
    const crewIds = rows.map((r) => r.crew_person_id);
    const requiredCerts = (posting.required_certification_ids as string[]) ?? [];
    const shoreCategoryMap: Record<string, string[]> = {};
    const expsByPerson: Record<
      string,
      { start_date: string; end_date: string | null; is_current: boolean }[]
    > = {};
    const bundles: BundleMap = {};
    // id → { country_code, flag_emoji } so the response can carry both
    // the new ISO code (for the FlagIcon SVG renderer) and the legacy
    // emoji (still surfaced for any caller that hasn't migrated).
    const nationalityFlagMap = new Map<string, { country_code: string; flag_emoji: string }>();

    if (crewIds.length > 0) {
      // Collect every nationality_id referenced by any applicant so we can
      // resolve flags in a single batch lookup. Multi-nationality (Fix 240):
      // candidate may hold multiple, all should render.
      const allNatIds = new Set<string>();
      for (const r of rows) {
        const ids = (r.profiles?.nationality_ids as string[] | null | undefined) ?? [];
        for (const id of ids) allNatIds.add(id);
      }

      const [shoreRes, expsRes, bundlesRes, natRes] = await Promise.all([
        serviceClient
          .from('shore_experiences')
          .select('person_id, shore_experience_categories(name)')
          .in('person_id', crewIds),
        serviceClient
          .from('crew_experiences')
          .select('person_id, start_date, end_date, is_current')
          .in('person_id', crewIds),
        // Only fetch bundles when the posting actually requires certs —
        // otherwise the cert-match calc is a no-op and we save a query.
        requiredCerts.length > 0
          ? serviceClient
              .from('certification_components')
              .select('bundle_cert_id, component_cert_id')
          : Promise.resolve({
              data: [] as { bundle_cert_id: string; component_cert_id: string }[],
            }),
        allNatIds.size > 0
          ? serviceClient
              .from('nationalities')
              .select('id, country_code, flag_emoji')
              .in('id', Array.from(allNatIds))
          : Promise.resolve({
              data: [] as { id: string; country_code: string; flag_emoji: string }[],
            }),
      ]);

      for (const se of shoreRes.data ?? []) {
        const cat = se.shore_experience_categories as unknown as { name: string } | null;
        if (cat?.name) {
          if (!shoreCategoryMap[se.person_id]) shoreCategoryMap[se.person_id] = [];
          if (!shoreCategoryMap[se.person_id].includes(cat.name)) {
            shoreCategoryMap[se.person_id].push(cat.name);
          }
        }
      }

      for (const e of (expsRes.data as
        | { person_id: string; start_date: string; end_date: string | null; is_current: boolean }[]
        | null) ?? []) {
        if (!expsByPerson[e.person_id]) expsByPerson[e.person_id] = [];
        expsByPerson[e.person_id].push({
          start_date: e.start_date,
          end_date: e.end_date,
          is_current: e.is_current,
        });
      }

      for (const row of (bundlesRes.data as
        | { bundle_cert_id: string; component_cert_id: string }[]
        | null) ?? []) {
        if (!bundles[row.bundle_cert_id]) bundles[row.bundle_cert_id] = [];
        bundles[row.bundle_cert_id].push(row.component_cert_id);
      }

      for (const n of (natRes.data as
        | { id: string; country_code: string; flag_emoji: string }[]
        | null) ?? []) {
        nationalityFlagMap.set(n.id, {
          country_code: n.country_code,
          flag_emoji: n.flag_emoji,
        });
      }
    }

    const requiredSet = new Set(requiredCerts);

    // B-003 Phase 2: hydrate accepted references for shortlisted-or-downstream
    // applicants so the shortlist tab can render a Contact references button
    // without an extra round-trip. Service client bypasses owner-scoped RLS
    // on `references` (mig 00125); the application-status filter is the
    // access control here.
    const shortlistedCrewIds = rows
      .filter((a) => a.status === 'shortlisted' || a.status === 'selected')
      .map((a) => a.crew_person_id as string);
    const referencesByCrew: Record<
      string,
      Array<{
        id: string;
        referee_person_id: string;
        claimed_referee_name: string;
        claimed_referee_role: string | null;
        snapshot_vessel_name: string | null;
        referee_display_name: string | null;
        referee_role_name: string | null;
        referee_role_department: string | null;
      }>
    > = {};
    if (shortlistedCrewIds.length > 0) {
      const { data: refRows } = await serviceClient
        .from('references')
        .select(
          `id, requester_person_id, referee_person_id, claimed_referee_role,
           claimed_referee_name, snapshot_vessel_name, consented_at`,
        )
        .in('requester_person_id', shortlistedCrewIds)
        .eq('status', 'accepted')
        .not('referee_person_id', 'is', null)
        .order('consented_at', { ascending: false });

      const refereeIds = Array.from(
        new Set(
          ((refRows ?? []) as { referee_person_id: string | null }[])
            .map((r) => r.referee_person_id)
            .filter((id): id is string => !!id),
        ),
      );
      const profileMapRefs = new Map<
        string,
        { display_name: string | null; primary_role_id: string | null }
      >();
      const roleMapRefs = new Map<string, { id: string; name: string; department: string }>();
      if (refereeIds.length > 0) {
        const { data: profileRows } = await serviceClient
          .from('profiles')
          .select('person_id, display_name, primary_role_id')
          .in('person_id', refereeIds);
        for (const p of (profileRows ?? []) as {
          person_id: string;
          display_name: string | null;
          primary_role_id: string | null;
        }[]) {
          profileMapRefs.set(p.person_id, {
            display_name: p.display_name,
            primary_role_id: p.primary_role_id,
          });
        }
        const refRoleIds = Array.from(
          new Set(
            Array.from(profileMapRefs.values())
              .map((p) => p.primary_role_id)
              .filter((id): id is string => !!id),
          ),
        );
        if (refRoleIds.length > 0) {
          const { data: roleRows } = await serviceClient
            .from('yacht_roles')
            .select('id, name, department')
            .in('id', refRoleIds);
          for (const r of (roleRows ?? []) as {
            id: string;
            name: string;
            department: string;
          }[]) {
            roleMapRefs.set(r.id, r);
          }
        }
      }

      for (const r of (refRows ?? []) as {
        id: string;
        requester_person_id: string;
        referee_person_id: string;
        claimed_referee_role: string;
        claimed_referee_name: string;
        snapshot_vessel_name: string | null;
      }[]) {
        const profile = profileMapRefs.get(r.referee_person_id);
        const role = profile?.primary_role_id
          ? roleMapRefs.get(profile.primary_role_id)
          : undefined;
        if (!referencesByCrew[r.requester_person_id]) {
          referencesByCrew[r.requester_person_id] = [];
        }
        referencesByCrew[r.requester_person_id].push({
          id: r.id,
          referee_person_id: r.referee_person_id,
          claimed_referee_name: r.claimed_referee_name,
          claimed_referee_role: r.claimed_referee_role ?? null,
          snapshot_vessel_name: r.snapshot_vessel_name ?? null,
          referee_display_name: profile?.display_name ?? null,
          referee_role_name: role?.name ?? null,
          referee_role_department: role?.department ?? null,
        });
      }
    }

    // B-011: surface the shortlist-phase engagement id (if one exists) so the
    // shortlist tab can render "Continue chat" instead of "Open chat" without
    // an extra round-trip per card. One row per (posting, crew) by virtue of
    // ON CONFLICT (application_id) DO NOTHING in the projection.
    const shortlistChatByCrew: Record<string, string> = {};
    if (shortlistedCrewIds.length > 0) {
      const { data: chatRows } = await serviceClient
        .from('active_engagements')
        .select('id, crew_person_id')
        .eq('permanent_posting_id', postingId)
        .eq('phase', 'shortlist')
        .in('crew_person_id', shortlistedCrewIds);
      for (const c of (chatRows ?? []) as { id: string; crew_person_id: string }[]) {
        shortlistChatByCrew[c.crew_person_id] = c.id;
      }
    }

    const applicants = rows.map((app) => {
      const profile = app.profiles;
      const candidateCerts = (profile?.certification_ids as string[]) ?? [];
      const myExps = expsByPerson[app.crew_person_id] ?? [];
      const totalExperienceLabel = myExps.length > 0 ? computeTotalExperience(myExps) : null;
      const certMatch =
        requiredCerts.length > 0 ? meetsRequirements(candidateCerts, requiredCerts, bundles) : null;

      // "Extras" — certs the candidate holds that aren't contributing to a
      // required cert, directly or via bundle (either direction). Surfaces
      // over-qualification on the card. Always computed (independent of
      // cert_match) so a posting with zero required certs still shows a
      // candidate's bonus. Returns IDs (not names) — UI resolves names via
      // the lookups context for the expandable +N more pill (B-001).
      let certExtraIds: string[] = [];
      if (candidateCerts.length > 0) {
        const candidateSet = new Set(candidateCerts);
        const usedForRequired = new Set<string>();
        for (const c of candidateCerts) {
          if (requiredSet.has(c)) {
            usedForRequired.add(c);
            continue;
          }
          const components = bundles[c];
          if (components && components.some((comp) => requiredSet.has(comp))) {
            usedForRequired.add(c);
            continue;
          }
          // Direction 2: c is a component of a required bundle that the
          // candidate's full holdings satisfy (every other component held).
          for (const r of requiredCerts) {
            const reqComponents = bundles[r];
            if (
              reqComponents &&
              reqComponents.length > 0 &&
              reqComponents.includes(c) &&
              reqComponents.every((rc) => candidateSet.has(rc))
            ) {
              usedForRequired.add(c);
              break;
            }
          }
        }
        certExtraIds = candidateCerts.filter((c) => !usedForRequired.has(c));
      }

      return {
        id: app.id,
        crew_person_id: app.crew_person_id,
        status: app.status,
        message: app.message,
        applied_at: app.created_at,
        source: app.source,
        // v2.1: surfaced so the review-queue card can render an
        // "✉ Invited" badge for applications that came in via a
        // PERMANENT.INVITED deep link. Boolean flag is enough — the
        // invitation row itself isn't shown.
        invited: Boolean(app.invited_from_id),
        display_name: profile?.display_name ?? null,
        bio: profile?.bio ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role_name: profile?.yacht_roles?.name ?? null,
        role_department: profile?.yacht_roles?.department ?? null,
        experience_label: profile?.experience_brackets?.label ?? null,
        certification_ids: candidateCerts,
        languages: profile?.languages ?? [],
        nationality_name: profile?.nationalities?.name ?? null,
        nationality_flag: profile?.nationalities?.flag_emoji ?? null,
        nationality_code: profile?.nationalities?.country_code ?? null,
        // Full ordered set of flag emojis — multi-nationality. Falls back
        // to single nationality_id flag if nationality_ids is empty.
        // Kept for backwards compat; new renderers should use
        // nationality_codes instead.
        nationality_flags: (() => {
          const ids = (profile?.nationality_ids as string[] | null | undefined) ?? [];
          if (ids.length > 0) {
            return ids
              .map((id) => nationalityFlagMap.get(id)?.flag_emoji)
              .filter((f): f is string => Boolean(f));
          }
          return profile?.nationalities?.flag_emoji ? [profile.nationalities.flag_emoji] : [];
        })(),
        // ISO 3166-1 alpha-2 codes — same order as nationality_flags.
        // Drives the FlagIcon SVG renderer (Windows-safe).
        nationality_codes: (() => {
          const ids = (profile?.nationality_ids as string[] | null | undefined) ?? [];
          if (ids.length > 0) {
            return ids
              .map((id) => nationalityFlagMap.get(id)?.country_code)
              .filter((c): c is string => Boolean(c));
          }
          return profile?.nationalities?.country_code ? [profile.nationalities.country_code] : [];
        })(),
        port_name: profile?.ports?.name ?? null,
        city_name: profile?.ports?.cities?.name ?? null,
        permanent_availability: profile?.permanent_availability ?? null,
        notice_period_days: profile?.notice_period_days ?? null,
        currently_employed: profile?.currently_employed ?? false,
        vessel_size_exposure_ids: (profile?.vessel_size_exposure_ids as string[]) ?? [],
        shore_experience_categories: shoreCategoryMap[app.crew_person_id] ?? [],
        total_experience_label: totalExperienceLabel,
        cert_match: certMatch
          ? {
              ok: certMatch.ok,
              matched: requiredCerts.length - certMatch.missing.length,
              total: requiredCerts.length,
              missing_count: certMatch.missing.length,
            }
          : null,
        cert_extras: certExtraIds.length,
        cert_extras_ids: certExtraIds,
        // B-003 Phase 2: empty array for non-shortlisted applicants — the
        // contact-API shortlist gate would 403 there anyway.
        references: referencesByCrew[app.crew_person_id] ?? [],
        // B-011: present only for shortlisted candidates with an open chat.
        // null on shortlisted-without-chat (employer hasn't opted in yet);
        // null on applied/selected (state machine doesn't permit).
        shortlist_chat_engagement_id: shortlistChatByCrew[app.crew_person_id] ?? null,
      };
    });

    return NextResponse.json({
      applicants,
      shortlist_cap: posting.shortlist_cap,
      shortlist_count: shortlistCount,
      posting_status: posting.status,
      selected_crew_id: selectedCrew?.crew_person_id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
