import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/mine
 * Returns the authenticated user's daywork postings with related data.
 * Optional query params: ?status=active&roleId=&portId=
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    let query = supabase
      .from('dayworks')
      .select(
        `
      id, job_number, role_context, start_date, end_date, working_days,
      day_rate, currency, meals, notes, status, created_at, positions_available, positions_filled, permanent_opportunity,
      yacht_roles(name),
      ports(name, cities(name, regions(name))),
      vessels(name, nda_flag, vessel_size_bands(label)),
      experience_brackets(label)
    `,
      )
      .eq('poster_person_id', user.id)
      .order('created_at', { ascending: false });

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.trim());
      query = query.in('status', statuses);
    }

    const filterRoleId = searchParams.get('roleId');
    if (filterRoleId) {
      query = query.eq('role_id', filterRoleId);
    }

    const filterPortId = searchParams.get('portId');
    if (filterPortId) {
      query = query.eq('location_port_id', filterPortId);
    }

    const { data: dayworks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Batch-count pending applicants per posting (applied / viewed / shortlisted)
    // so the My Jobs cards can show a "N awaiting review" badge on the Review
    // applicants button without per-posting round-trips.
    const dayworkIds = (dayworks ?? []).map((dw) => dw.id as string);
    const applicantCountByDaywork = new Map<string, number>();
    if (dayworkIds.length > 0) {
      const { data: apps } = await supabase
        .from('applications')
        .select('daywork_id')
        .in('daywork_id', dayworkIds)
        .in('status', ['applied', 'viewed', 'shortlisted']);
      for (const a of apps ?? []) {
        const dwId = a.daywork_id as string;
        applicantCountByDaywork.set(dwId, (applicantCountByDaywork.get(dwId) ?? 0) + 1);
      }
    }

    // Add computed is_overdue flag for active postings past end_date
    const todayStr = new Date().toISOString().slice(0, 10);
    const enriched = (dayworks ?? []).map((dw) => ({
      ...dw,
      is_overdue: dw.status === 'active' && dw.end_date < todayStr,
      applicant_count: applicantCountByDaywork.get(dw.id as string) ?? 0,
    }));

    return NextResponse.json({ dayworks: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
