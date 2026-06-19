import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/permanent/:id/cancel
 * Employer cancels permanent posting. Projection handles engagement close if in_negotiation.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can cancel postings' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const reason =
      body.reason && typeof body.reason === 'string' ? body.reason.slice(0, 250) : null;

    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (!['active', 'in_negotiation'].includes(posting.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a ${posting.status} posting` },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.CANCELLED_BY_EMPLOYER',
      aggregateId: postingId,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: { permanent_posting_id: postingId, reason },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.CANCELLED_BY_EMPLOYER',
      { permanent_posting_id: postingId },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel posting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
