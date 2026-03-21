import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/engagements?status=active&older_than=<days>
 * Admin-only stuck engagement listing.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'active';
  const olderThanDays = parseInt(searchParams.get('older_than') ?? '14', 10);

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await serviceClient
      .from('active_engagements')
      .select(
        'id, daywork_id, permanent_posting_id, crew_person_id, employer_person_id, start_date, end_date, created_at, crew_profile:profiles!active_engagements_crew_person_id_profiles_fkey(display_name), employer_profile:profiles!active_engagements_employer_person_id_profiles_fkey(display_name)',
      )
      .eq('status', status)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const engagements = (data ?? []).map((e) => ({
      id: e.id,
      daywork_id: e.daywork_id,
      crew_name:
        (e.crew_profile as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
      employer_name:
        (e.employer_profile as unknown as { display_name: string } | null)?.display_name ??
        'Unknown',
      start_date: e.start_date,
      end_date: e.end_date,
      days_active: Math.ceil(
        (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));

    return NextResponse.json({ engagements });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list engagements';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
