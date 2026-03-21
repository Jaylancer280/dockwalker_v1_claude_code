import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/permanent/mine
 * Returns all permanent postings owned by the authenticated employer,
 * with application counts and selected crew name for in_negotiation postings.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can view their postings' }, { status: 403 });
  }

  try {
    const { data: postings, error } = await supabase
      .from('permanent_postings')
      .select(
        `
        id, job_number, start_date, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, shortlist_cap, notes, status, created_at,
        yacht_roles(name),
        ports(name, cities(name, regions(name))),
        vessels(name, nda_flag, vessel_type),
        experience_brackets(label)
      `,
      )
      .eq('employer_person_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (postings ?? []) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ postings: [] });
    }

    const postingIds = rows.map((p) => p.id as string);

    // Batch fetch application counts (single query, not N+1)
    const { data: appRows } = await supabase
      .from('applications')
      .select('permanent_posting_id, status')
      .in('permanent_posting_id', postingIds)
      .neq('status', 'withdrawn');

    // Group counts by posting
    const countMap = new Map<string, { applied: number; shortlisted: number; total: number }>();
    for (const app of appRows ?? []) {
      const pid = app.permanent_posting_id as string;
      if (!countMap.has(pid)) countMap.set(pid, { applied: 0, shortlisted: 0, total: 0 });
      const counts = countMap.get(pid)!;
      counts.total++;
      if (app.status === 'applied') counts.applied++;
      if (app.status === 'shortlisted' || app.status === 'selected') counts.shortlisted++;
    }

    // Fetch selected crew names for in_negotiation postings
    const inNegotiationIds = rows
      .filter((p) => p.status === 'in_negotiation')
      .map((p) => p.id as string);

    const selectedNameMap = new Map<string, string>();
    if (inNegotiationIds.length > 0) {
      const { data: selectedApps } = await supabase
        .from('applications')
        .select(
          'permanent_posting_id, profiles!applications_crew_person_id_profiles_fkey(display_name)',
        )
        .in('permanent_posting_id', inNegotiationIds)
        .eq('status', 'selected');

      for (const app of selectedApps ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (app as any).profiles?.display_name;
        if (name) selectedNameMap.set(app.permanent_posting_id as string, name);
      }
    }

    const hydrated = rows.map((p) => {
      const counts = countMap.get(p.id) ?? { applied: 0, shortlisted: 0, total: 0 };
      return {
        ...p,
        applicant_count: counts.applied,
        shortlist_count: counts.shortlisted,
        total_applications: counts.total,
        selected_crew_name: selectedNameMap.get(p.id) ?? null,
      };
    });

    return NextResponse.json({ postings: hydrated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
