import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import { refIdemKey } from '@/lib/references/helpers';

/**
 * POST /api/references/[id]/resend
 *
 *   - Auth required, must be the requester.
 *   - Reference must be `pending` or `expired`.
 *   - Atomic 2-event flow: REVOKED_BY_REQUESTER (closes the audit trail on
 *     the old row) → fresh REFERENCE.REQUESTED with a NEW token, NEW
 *     pending_expires_at, but reusing the SAME snapshot fields.
 *   - B-3: idempotency key salted with `:resend:${oldRefId}` so D-1 dedup
 *     doesn't drop the new request as a duplicate of the original.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id: oldRefId } = await params;

    const { data: oldRef } = await serviceClient
      .from('references')
      .select(
        [
          'id',
          'requester_person_id',
          'experience_id',
          'vessel_id',
          'requester_role_at_time',
          'claimed_referee_role',
          'claimed_referee_name',
          'claimed_referee_email',
          'snapshot_vessel_imo',
          'snapshot_vessel_name',
          'snapshot_start_date',
          'snapshot_end_date',
          'status',
        ].join(','),
      )
      .eq('id', oldRefId)
      .maybeSingle<{
        id: string;
        requester_person_id: string;
        experience_id: string | null;
        vessel_id: string | null;
        requester_role_at_time: string;
        claimed_referee_role: string;
        claimed_referee_name: string;
        claimed_referee_email: string | null;
        snapshot_vessel_imo: string;
        snapshot_vessel_name: string;
        snapshot_start_date: string;
        snapshot_end_date: string | null;
        status: string;
      }>();
    if (!oldRef) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if (oldRef.requester_person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['pending', 'expired'].includes(oldRef.status)) {
      return NextResponse.json(
        { error: 'Only pending or expired references can be resent' },
        { status: 409 },
      );
    }
    if (!oldRef.experience_id || !oldRef.vessel_id) {
      return NextResponse.json(
        { error: 'Cannot resend — original experience or vessel was removed' },
        { status: 409 },
      );
    }

    const newRefId = randomUUID();
    const newToken = randomUUID();

    await appendEvents(serviceClient, [
      {
        eventType: 'REFERENCE.REVOKED_BY_REQUESTER',
        aggregateId: oldRefId,
        aggregateType: 'reference',
        roleContext: person.current_hat,
        payload: {},
        personId: user.id,
      },
      {
        eventType: 'REFERENCE.REQUESTED',
        aggregateId: newRefId,
        aggregateType: 'reference',
        roleContext: 'crew',
        payload: {
          id: newRefId,
          experience_id: oldRef.experience_id,
          vessel_id: oldRef.vessel_id,
          requester_role_at_time: oldRef.requester_role_at_time,
          claimed_referee_role: oldRef.claimed_referee_role,
          claimed_referee_name: oldRef.claimed_referee_name,
          claimed_referee_email: oldRef.claimed_referee_email,
          token: newToken,
          snapshot_vessel_imo: oldRef.snapshot_vessel_imo,
          snapshot_vessel_name: oldRef.snapshot_vessel_name,
          snapshot_start_date: oldRef.snapshot_start_date,
          snapshot_end_date: oldRef.snapshot_end_date,
        },
        personId: user.id,
        idempotencyKey: refIdemKey.resend(oldRefId),
      },
    ]);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';
    return NextResponse.json({ id: newRefId, token: newToken, link: `${siteUrl}/ref/${newToken}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
