import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent, appendEvents } from '@dockwalker/db';
import { refIdemKey } from '@/lib/references/helpers';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/references/[id]/accept
 *
 *   - Auth required.
 *   - Validates the reference is `pending` and `pending_expires_at > now()`.
 *   - Email-match: if the original request specified `claimed_referee_email`,
 *     the auth'd user's email must match (case-insensitive).
 *   - Body optionally accepts `comment: string | null` (max 500 chars). If
 *     provided, fires REFERENCE.ACCEPTED + REFERENCE.COMMENT_UPDATED as an
 *     atomic batch.
 *   - Notification: REFERENCE.ACCEPTED fan-out to the requester.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;
    const { id } = await params;

    const { data: ref } = await serviceClient
      .from('references')
      .select(
        'id, requester_person_id, status, pending_expires_at, claimed_referee_email, snapshot_vessel_name',
      )
      .eq('id', id)
      .maybeSingle<{
        id: string;
        requester_person_id: string;
        status: string;
        pending_expires_at: string;
        claimed_referee_email: string | null;
        snapshot_vessel_name: string;
      }>();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if (ref.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation is no longer pending' }, { status: 410 });
    }
    if (new Date(ref.pending_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Email-match enforcement.
    if (ref.claimed_referee_email) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const authEmail = (authUser?.email ?? '').toLowerCase();
      if (authEmail !== ref.claimed_referee_email.toLowerCase()) {
        return NextResponse.json(
          { error: 'This invitation was sent to a different email' },
          { status: 403 },
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as { comment?: string | null };
    const comment = typeof body.comment === 'string' ? body.comment.trim() : (body.comment ?? null);
    if (comment && comment.length > 500) {
      return NextResponse.json(
        { error: 'Comment must be 500 characters or less' },
        { status: 400 },
      );
    }

    const acceptIdemKey = refIdemKey.accept(id);

    if (comment && comment.length > 0) {
      await appendEvents(serviceClient, [
        {
          eventType: 'REFERENCE.ACCEPTED',
          aggregateId: id,
          aggregateType: 'reference',
          roleContext: person.current_hat,
          payload: {},
          personId: user.id,
          idempotencyKey: acceptIdemKey,
        },
        {
          eventType: 'REFERENCE.COMMENT_UPDATED',
          aggregateId: id,
          aggregateType: 'reference',
          roleContext: person.current_hat,
          payload: { reference_id: id, comment },
          personId: user.id,
        },
      ]);
    } else {
      await appendEvent(serviceClient, {
        eventType: 'REFERENCE.ACCEPTED',
        aggregateId: id,
        aggregateType: 'reference',
        roleContext: person.current_hat,
        payload: {},
        personId: user.id,
        idempotencyKey: acceptIdemKey,
      });
    }

    notifyOnEvent(
      serviceClient,
      'REFERENCE.ACCEPTED',
      {
        reference_id: id,
        recipient_person_id: ref.requester_person_id,
        snapshot_vessel_name: ref.snapshot_vessel_name,
      },
      user.id,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
