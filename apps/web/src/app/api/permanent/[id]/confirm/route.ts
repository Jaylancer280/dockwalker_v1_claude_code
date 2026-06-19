import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/permanent/:id/confirm
 * Employer confirms placement. Posting → filled. Remaining → not_selected.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can confirm placement' }, { status: 403 });
  }

  try {
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (posting.status !== 'in_negotiation') {
      return NextResponse.json(
        { error: `Cannot confirm placement when posting is ${posting.status}` },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.PLACEMENT_CONFIRMED',
      aggregateId: postingId,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: { permanent_posting_id: postingId },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.PLACEMENT_CONFIRMED',
      { permanent_posting_id: postingId },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to confirm placement';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
