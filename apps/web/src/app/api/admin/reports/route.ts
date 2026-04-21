import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

const PAGE_SIZE = 20;

/**
 * GET /api/admin/reports
 *
 * Query params:
 *   status — comma-separated list of {open, reviewing, dismissed, actioned}
 *            (defaults to all)
 *   reason — comma-separated reason_category filter (defaults to all)
 *   page   — 1-indexed page number (default 1)
 *
 * Sort: safety_concern first (categorical priority), then created_at DESC.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const reasonParam = url.searchParams.get('reason');
  const filedAgainst = url.searchParams.get('filed_against');
  const filedBy = url.searchParams.get('filed_by');
  const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const statuses = statusParam
    ? statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const reasons = reasonParam
    ? reasonParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  let query = serviceClient.from('reports').select(
    `id, reporter_person_id, reported_person_id, engagement_id,
       reason_category, reason_text, status, resolution, admin_notes,
       admin_person_id, created_at, resolved_at,
       reporter:profiles!reports_reporter_person_id_fkey (person_id, display_name),
       reported:profiles!reports_reported_person_id_fkey (person_id, display_name)`,
    { count: 'exact' },
  );

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses);
  }
  if (reasons && reasons.length > 0) {
    query = query.in('reason_category', reasons);
  }
  if (filedAgainst) {
    query = query.eq('reported_person_id', filedAgainst);
  }
  if (filedBy) {
    query = query.eq('reporter_person_id', filedBy);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await query
    // safety_concern first via ordering on the derived column
    .order('reason_category', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Secondary in-memory sort to put safety_concern ahead — Postgres doesn't
  // have a natural way to prioritise one enum value across the page.
  const rows = (data ?? [])
    .slice()
    .sort((a, b) => {
      const aP = a.reason_category === 'safety_concern' ? 0 : 1;
      const bP = b.reason_category === 'safety_concern' ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .map((row) => {
      const reporter = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
      const reported = Array.isArray(row.reported) ? row.reported[0] : row.reported;
      return {
        id: row.id,
        reporter_person_id: row.reporter_person_id,
        reporter_name: reporter?.display_name ?? null,
        reported_person_id: row.reported_person_id,
        reported_name: reported?.display_name ?? null,
        engagement_id: row.engagement_id,
        reason_category: row.reason_category,
        status: row.status,
        resolution: row.resolution,
        created_at: row.created_at,
      };
    });

  return NextResponse.json({
    reports: rows,
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
  });
}
