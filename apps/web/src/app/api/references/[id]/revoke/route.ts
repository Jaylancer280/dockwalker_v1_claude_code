import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/references/[id]/revoke
 *
 *   - Auth required.
 *   - Routes to REFERENCE.REVOKED_BY_REQUESTER (allows pending+accepted) or
 *     REFERENCE.REVOKED_BY_REFEREE (accepted only) based on whether the
 *     caller is the requester or the referee. 403 if neither.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id } = await params;

    const { data: ref } = await serviceClient
      .from('references')
      .select('id, status, requester_person_id, referee_person_id')
      .eq('id', id)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    const isRequester = (ref.requester_person_id as string) === user.id;
    const isReferee = (ref.referee_person_id as string | null) === user.id;
    if (!isRequester && !isReferee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isRequester) {
      if (!['pending', 'accepted'].includes(ref.status as string)) {
        return NextResponse.json(
          { error: 'Reference is not in a revokable state' },
          { status: 409 },
        );
      }
      await appendEvent(serviceClient, {
        eventType: 'REFERENCE.REVOKED_BY_REQUESTER',
        aggregateId: id,
        aggregateType: 'reference',
        roleContext: person.current_hat,
        payload: {},
        personId: user.id,
      });
    } else {
      if ((ref.status as string) !== 'accepted') {
        return NextResponse.json(
          { error: 'Only accepted references can be revoked by the referee' },
          { status: 409 },
        );
      }
      await appendEvent(serviceClient, {
        eventType: 'REFERENCE.REVOKED_BY_REFEREE',
        aggregateId: id,
        aggregateType: 'reference',
        roleContext: person.current_hat,
        payload: {},
        personId: user.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
