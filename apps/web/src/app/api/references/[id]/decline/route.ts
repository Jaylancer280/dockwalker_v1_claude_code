import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/references/[id]/decline
 *
 *   - Auth required.
 *   - Fires REFERENCE.DECLINED. No notification — decline is silent per the
 *     UX rule (requester sees "Pending response" until expiry).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id } = await params;

    const { data: ref } = await serviceClient
      .from('references')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if ((ref.status as string) !== 'pending') {
      return NextResponse.json({ error: 'This invitation is no longer pending' }, { status: 410 });
    }

    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.DECLINED',
      aggregateId: id,
      aggregateType: 'reference',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
