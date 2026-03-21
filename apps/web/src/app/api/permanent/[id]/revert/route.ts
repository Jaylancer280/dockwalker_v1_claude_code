import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/permanent/:id/revert
 * Employer reverts selection. Engagement closed. Posting → active.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can revert selection' }, { status: 403 });
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
        { error: `Cannot revert when posting is ${posting.status}` },
        { status: 400 },
      );
    }

    // Find the active engagement
    const { data: engagement } = await supabase
      .from('active_engagements')
      .select('id')
      .eq('permanent_posting_id', postingId)
      .eq('status', 'active')
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'No active engagement found' }, { status: 400 });
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.SELECTION_REVERTED',
      aggregateId: postingId,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: { permanent_posting_id: postingId, engagement_id: engagement.id },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.SELECTION_REVERTED',
      { permanent_posting_id: postingId, engagement_id: engagement.id },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to revert selection';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
