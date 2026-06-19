import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

const VALID_OUTCOMES = ['successful_placement', 'not_successful', 'withdrew'] as const;

/**
 * POST /api/permanent/engagements/:id/close
 * Either party closes a permanent engagement conversation.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  try {
    const body = await request.json().catch(() => ({}));
    const outcome = body.outcome as string;

    if (!outcome || !VALID_OUTCOMES.includes(outcome as (typeof VALID_OUTCOMES)[number])) {
      return NextResponse.json(
        {
          error:
            'outcome is required and must be one of: successful_placement, not_successful, withdrew',
        },
        { status: 400 },
      );
    }

    const { data: engagement } = await supabase
      .from('active_engagements')
      .select('id, crew_person_id, employer_person_id, permanent_posting_id, status')
      .eq('id', engagementId)
      .not('permanent_posting_id', 'is', null)
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'Permanent engagement not found' }, { status: 404 });
    }

    if (user.id !== engagement.crew_person_id && user.id !== engagement.employer_person_id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    if (engagement.status !== 'active') {
      return NextResponse.json(
        { error: `Engagement is already ${engagement.status}` },
        { status: 400 },
      );
    }

    const closedBy = user.id === engagement.crew_person_id ? 'crew' : 'employer';

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.ENGAGEMENT_CLOSED',
      aggregateId: engagement.permanent_posting_id,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: {
        engagement_id: engagementId,
        outcome: outcome as 'successful_placement' | 'not_successful' | 'withdrew',
        closed_by: closedBy,
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.ENGAGEMENT_CLOSED',
      { engagement_id: engagementId, outcome, closed_by: closedBy },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to close engagement';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
