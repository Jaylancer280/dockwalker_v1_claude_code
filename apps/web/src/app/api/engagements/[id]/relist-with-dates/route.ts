import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/relist-with-dates
 * Employer relists the daywork with the proposed postponement dates after crew rejection.
 * Only available when engagement is cancelled and postponement_status is 'rejected'.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select(
      'id, employer_person_id, daywork_id, status, postponement_status, proposed_start_date, proposed_end_date, proposed_working_days',
    )
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Only the employer can relist' }, { status: 403 });
  }

  if (engagement.status !== 'cancelled') {
    return NextResponse.json({ error: 'Engagement is not cancelled' }, { status: 400 });
  }

  if (engagement.postponement_status !== 'rejected') {
    return NextResponse.json({ error: 'No rejected postponement to relist from' }, { status: 400 });
  }

  // Check daywork is not already relisted
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, status')
    .eq('id', engagement.daywork_id)
    .single();

  if (daywork?.status === 'active') {
    return NextResponse.json({ error: 'This job has already been relisted' }, { status: 400 });
  }

  try {
    await appendEvents(serviceClient, [
      {
        eventType: 'DAYWORK.RELISTED',
        aggregateId: engagement.daywork_id,
        aggregateType: 'daywork',
        roleContext: 'employer',
        payload: {
          daywork_id: engagement.daywork_id,
          start_date: engagement.proposed_start_date,
          end_date: engagement.proposed_end_date,
          working_days: engagement.proposed_working_days,
        },
        personId: user.id,
      },
      {
        eventType: 'MESSAGE.SENT',
        aggregateId: engagementId,
        aggregateType: 'message',
        roleContext: 'employer',
        payload: {
          id: randomUUID(),
          engagement_id: engagementId,
          sender_person_id: user.id,
          content: 'Job has been relisted with the proposed dates.',
          is_system: true,
        },
        personId: user.id,
      },
    ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to relist';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
