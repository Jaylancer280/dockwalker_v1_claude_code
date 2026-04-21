import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/admin/postings/:id/hide
 * Hide a posting by setting its status to 'cancelled'. Works for daywork
 * (status active|in_progress) and permanent (status active|in_negotiation).
 * Body: { posting_type: 'daywork' | 'permanent', reason: string }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { id: postingId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const postingType =
    body && typeof body === 'object' && 'posting_type' in body
      ? (body as { posting_type: unknown }).posting_type
      : null;
  const reason =
    body && typeof body === 'object' && 'reason' in body
      ? (body as { reason: unknown }).reason
      : null;

  if (postingType !== 'daywork' && postingType !== 'permanent') {
    return NextResponse.json(
      { error: "posting_type must be 'daywork' or 'permanent'" },
      { status: 400 },
    );
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const table = postingType === 'daywork' ? 'dayworks' : 'permanent_postings';
  const hideableStatuses =
    postingType === 'daywork' ? ['active', 'in_progress'] : ['active', 'in_negotiation'];

  const { data: posting } = await serviceClient
    .from(table)
    .select('id, status')
    .eq('id', postingId)
    .single();

  if (!posting) {
    return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
  }

  if (!hideableStatuses.includes(posting.status)) {
    return NextResponse.json(
      { error: `Cannot hide posting in ${posting.status} status` },
      { status: 400 },
    );
  }

  await appendEvent(serviceClient, {
    eventType: 'ADMIN.POSTING_HIDDEN',
    aggregateId: postingId,
    aggregateType: 'admin',
    roleContext: 'employer',
    payload: {
      posting_id: postingId,
      posting_type: postingType,
      reason: reason.trim(),
      admin_person_id: adminPerson.id,
    },
    personId: adminPerson.id,
  });

  return NextResponse.json({ success: true });
}
