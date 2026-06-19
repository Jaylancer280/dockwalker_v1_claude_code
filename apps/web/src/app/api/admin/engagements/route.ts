import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/engagements?status=active&older_than=<days>&page=<n>
 * Admin-only engagement listing. Supports all statuses and optional stuck filter.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const olderThanDays = searchParams.get('older_than');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  try {
    let query = serviceClient
      .from('active_engagements')
      .select(
        'id, status, daywork_id, permanent_posting_id, crew_person_id, employer_person_id, start_date, end_date, created_at, cancelled_by, crew_profile:profiles!active_engagements_crew_person_id_profiles_fkey(display_name), employer_profile:profiles!active_engagements_employer_person_id_profiles_fkey(display_name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (status) query = query.eq('status', status);
    if (olderThanDays) {
      const cutoff = new Date(Date.now() - parseInt(olderThanDays, 10) * 86400000).toISOString();
      query = query.lt('created_at', cutoff);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const engagements = (data ?? []).map((e) => ({
      id: e.id,
      status: e.status,
      daywork_id: e.daywork_id,
      permanent_posting_id: e.permanent_posting_id,
      type: e.daywork_id ? 'daywork' : 'permanent',
      crew_person_id: e.crew_person_id,
      employer_person_id: e.employer_person_id,
      crew_name:
        (e.crew_profile as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
      employer_name:
        (e.employer_profile as unknown as { display_name: string } | null)?.display_name ??
        'Unknown',
      start_date: e.start_date,
      end_date: e.end_date,
      cancelled_by: e.cancelled_by,
      days_active: Math.ceil(
        (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24),
      ),
      created_at: e.created_at,
    }));

    return NextResponse.json({ engagements, total: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list engagements';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
