import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/references/[id]/comment
 *
 *   - Auth required, must be the referee.
 *   - Reference must be `accepted`.
 *   - Body: `{ comment: string | null }` (max 500 chars; null/empty clears).
 *   - Fires REFERENCE.COMMENT_UPDATED + an in-app notification to the
 *     requester so silent edits to the public-facing comment can't slip
 *     past unnoticed. Audit lives in the event log; UI surfaces an
 *     "edited" badge via comment_updated_at.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id } = await params;

    const { data: ref } = await serviceClient
      .from('references')
      .select('id, status, referee_person_id, requester_person_id, snapshot_vessel_name')
      .eq('id', id)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if ((ref.referee_person_id as string | null) !== user.id) {
      return NextResponse.json({ error: 'Only the referee can edit the comment' }, { status: 403 });
    }
    if ((ref.status as string) !== 'accepted') {
      return NextResponse.json(
        { error: 'Comment can only be edited on an accepted reference' },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { comment?: string | null };
    const comment = typeof body.comment === 'string' ? body.comment.trim() : null;
    if (comment !== null && comment.length > 500) {
      return NextResponse.json(
        { error: 'Comment must be 500 characters or less' },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.COMMENT_UPDATED',
      aggregateId: id,
      aggregateType: 'reference',
      roleContext: person.current_hat,
      payload: { reference_id: id, comment },
      personId: user.id,
    });

    // Notify the requester so they can't be silently rewritten on.
    notifyOnEvent(
      serviceClient,
      'REFERENCE.COMMENT_UPDATED',
      {
        reference_id: id,
        recipient_person_id: ref.requester_person_id as string,
        snapshot_vessel_name: ref.snapshot_vessel_name as string,
        cleared: comment === null || comment.length === 0,
      },
      user.id,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
