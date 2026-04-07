import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

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
      .select('id, employer_person_id, status, shortlist_cap')
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
          vessel_size_exposure_ids, nationality_id, visa_ids,
          permanent_availability, notice_period_days, currently_employed,
          yacht_roles(name, department),
          experience_brackets(label),
          ports(name, cities(name, regions(name))),
          nationalities(name, flag_emoji)
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

    const applicants = rows.map((app) => {
      const profile = app.profiles;
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
        certification_ids: profile?.certification_ids ?? [],
        languages: profile?.languages ?? [],
        nationality_name: profile?.nationalities?.name ?? null,
        nationality_flag: profile?.nationalities?.flag_emoji ?? null,
        port_name: profile?.ports?.name ?? null,
        city_name: profile?.ports?.cities?.name ?? null,
        permanent_availability: profile?.permanent_availability ?? null,
        notice_period_days: profile?.notice_period_days ?? null,
        currently_employed: profile?.currently_employed ?? false,
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
