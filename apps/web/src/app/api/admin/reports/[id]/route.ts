import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAdminAction } from '@/lib/admin/log-action';

const VALID_STATUSES = ['open', 'reviewing', 'dismissed', 'actioned'] as const;
const VALID_RESOLUTIONS = ['dismissed', 'warned', 'actioned'] as const;

/**
 * GET /api/admin/reports/:id
 * Returns the full report row + reporter / reported display names.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { id } = await params;

  const { data, error } = await serviceClient
    .from('reports')
    .select(
      `id, reporter_person_id, reported_person_id, engagement_id,
       reason_category, reason_text, status, resolution, admin_notes,
       admin_person_id, created_at, resolved_at,
       reporter:profiles!reports_reporter_person_id_fkey (person_id, display_name),
       reported:profiles!reports_reported_person_id_fkey (person_id, display_name),
       admin:profiles!reports_admin_person_id_fkey (person_id, display_name)`,
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const reporter = Array.isArray(data.reporter) ? data.reporter[0] : data.reporter;
  const reported = Array.isArray(data.reported) ? data.reported[0] : data.reported;
  const admin = Array.isArray(data.admin) ? data.admin[0] : data.admin;

  return NextResponse.json({
    report: {
      id: data.id,
      reporter_person_id: data.reporter_person_id,
      reporter_name: reporter?.display_name ?? null,
      reported_person_id: data.reported_person_id,
      reported_name: reported?.display_name ?? null,
      engagement_id: data.engagement_id,
      reason_category: data.reason_category,
      reason_text: data.reason_text,
      status: data.status,
      resolution: data.resolution,
      admin_notes: data.admin_notes,
      admin_person_id: data.admin_person_id,
      admin_name: admin?.display_name ?? null,
      created_at: data.created_at,
      resolved_at: data.resolved_at,
    },
  });
}

/**
 * PATCH /api/admin/reports/:id
 * Update report resolution. Body may include: status, admin_notes, resolution.
 * Setting a non-open status stamps admin_person_id + resolved_at automatically
 * (admin_person_id = the current admin, not the original reporter).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status =
    body && typeof body === 'object' && 'status' in body
      ? (body as { status: unknown }).status
      : undefined;
  const resolution =
    body && typeof body === 'object' && 'resolution' in body
      ? (body as { resolution: unknown }).resolution
      : undefined;
  const adminNotes =
    body && typeof body === 'object' && 'admin_notes' in body
      ? (body as { admin_notes: unknown }).admin_notes
      : undefined;

  if (
    status !== undefined &&
    (typeof status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(status))
  ) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (
    resolution !== undefined &&
    resolution !== null &&
    (typeof resolution !== 'string' ||
      !(VALID_RESOLUTIONS as readonly string[]).includes(resolution))
  ) {
    return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
  }
  if (adminNotes !== undefined && adminNotes !== null && typeof adminNotes !== 'string') {
    return NextResponse.json({ error: 'admin_notes must be a string' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (resolution !== undefined) updates.resolution = resolution;
  if (adminNotes !== undefined) updates.admin_notes = adminNotes;

  // Any terminal status or a resolution stamps the admin + resolved_at.
  const isTerminal = status === 'dismissed' || status === 'actioned' || resolution != null;
  if (isTerminal) {
    updates.admin_person_id = adminPerson.id;
    updates.resolved_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select('id, status, resolution, admin_notes, admin_person_id, resolved_at, reported_person_id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Report not found' }, { status: 404 });
  }

  // Only log when the report transitions to a terminal state (the same
  // condition that stamps admin_person_id + resolved_at). Open → reviewing
  // updates don't merit an audit row.
  if (isTerminal) {
    await logAdminAction(serviceClient, {
      adminPersonId: adminPerson.id,
      action: 'resolve_report',
      targetPersonId: data.reported_person_id ?? null,
      targetId: data.id,
      reason: typeof adminNotes === 'string' ? adminNotes : null,
      metadata: {
        status: data.status,
        resolution: data.resolution,
      },
    });
  }

  return NextResponse.json({ report: data });
}
