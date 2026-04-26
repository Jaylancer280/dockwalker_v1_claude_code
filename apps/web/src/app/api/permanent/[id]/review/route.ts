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
        id, crew_person_id, status, message, created_at, source,
        profiles!applications_crew_person_id_profiles_fkey(
          display_name, bio, avatar_url,
          primary_role_id, certification_ids, languages, experience_bracket_id,
          vessel_size_exposure_ids, nationality_id, entry_right_ids,
          permanent_availability, notice_period_days, currently_employed,
          yacht_roles:primary_role_id(name, department),
          experience_brackets:experience_bracket_id(label),
          ports:location_port_id(name, cities(name, regions(name))),
          nationalities:nationality_id(name, flag_emoji)
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

    if (crewIds.length > 0) {
      const [shoreRes, expsRes, bundlesRes] = await Promise.all([
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
    }

    const requiredSet = new Set(requiredCerts);

    const applicants = rows.map((app) => {
      const profile = app.profiles;
      const candidateCerts = (profile?.certification_ids as string[]) ?? [];
      const myExps = expsByPerson[app.crew_person_id] ?? [];
      const totalExperienceLabel = myExps.length > 0 ? computeTotalExperience(myExps) : null;
      const certMatch =
        requiredCerts.length > 0 ? meetsRequirements(candidateCerts, requiredCerts, bundles) : null;

      // "Extras" — certs the candidate holds that aren't contributing to a
      // required cert, directly or via bundle. Surfaces over-qualification
      // on the card. Always computed (independent of cert_match) so a
      // posting with zero required certs still shows a candidate's bonus.
      let certExtras = 0;
      if (candidateCerts.length > 0) {
        const usedForRequired = new Set<string>();
        for (const c of candidateCerts) {
          if (requiredSet.has(c)) {
            usedForRequired.add(c);
            continue;
          }
          const components = bundles[c];
          if (components && components.some((comp) => requiredSet.has(comp))) {
            usedForRequired.add(c);
          }
        }
        certExtras = candidateCerts.filter((c) => !usedForRequired.has(c)).length;
      }

      return {
        id: app.id,
        crew_person_id: app.crew_person_id,
        status: app.status,
        message: app.message,
        applied_at: app.created_at,
        source: app.source,
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
        cert_extras: certExtras,
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
