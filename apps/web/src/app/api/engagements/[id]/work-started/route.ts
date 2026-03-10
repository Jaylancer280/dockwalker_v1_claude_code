import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/work-started
 * Either party initiates or confirms that work has started.
 *
 * Body: { action: 'initiate' | 'confirm' }
 *
 * - Initiate: sets work_started_status to 'initiated_by_crew' or 'initiated_by_employer'
 * - Confirm: the OTHER party confirms, setting work_started_status to 'confirmed'
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, daywork_id, status, work_started_status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  const isCrew = engagement.crew_person_id === user.id;
  const isEmployer = engagement.employer_person_id === user.id;

  if (!isCrew && !isEmployer) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action !== 'initiate' && action !== 'confirm') {
    return NextResponse.json({ error: 'action must be "initiate" or "confirm"' }, { status: 400 });
  }

  const myRole = isCrew ? 'crew' : 'employer';

  try {
    if (action === 'initiate') {
      if (engagement.work_started_status !== null) {
        return NextResponse.json(
          { error: 'Work started has already been initiated or confirmed' },
          { status: 400 },
        );
      }

      const initiatorLabel = isCrew ? 'Crew' : 'Employer';
      await appendEvents(serviceClient, [
        {
          eventType: 'ENGAGEMENT.WORK_STARTED',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: myRole,
          payload: {
            engagement_id: engagementId,
            initiated_by: myRole,
          },
          personId: user.id,
        },
        {
          eventType: 'MESSAGE.SENT',
          aggregateId: engagementId,
          aggregateType: 'message',
          roleContext: myRole,
          payload: {
            id: randomUUID(),
            engagement_id: engagementId,
            sender_person_id: user.id,
            content: `${initiatorLabel} has confirmed that work has started. Waiting for the other party to confirm.`,
            is_system: true,
          },
          personId: user.id,
        },
      ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

      return NextResponse.json({ status: `initiated_by_${myRole}` });
    }

    // action === 'confirm'
    if (engagement.work_started_status === 'confirmed') {
      return NextResponse.json({ error: 'Work started already confirmed' }, { status: 400 });
    }

    if (engagement.work_started_status === null) {
      return NextResponse.json({ error: 'No work started initiation to confirm' }, { status: 400 });
    }

    // The confirming party must be the OTHER party from the initiator
    const initiatedBy = engagement.work_started_status.replace('initiated_by_', '');
    if (initiatedBy === myRole) {
      return NextResponse.json(
        { error: 'You initiated this — the other party must confirm' },
        { status: 400 },
      );
    }

    await appendEvents(serviceClient, [
      {
        eventType: 'ENGAGEMENT.WORK_STARTED_CONFIRMED',
        aggregateId: engagementId,
        aggregateType: 'engagement',
        roleContext: myRole,
        payload: {
          engagement_id: engagementId,
          confirmed_by: myRole,
        },
        personId: user.id,
      },
      {
        eventType: 'MESSAGE.SENT',
        aggregateId: engagementId,
        aggregateType: 'message',
        roleContext: myRole,
        payload: {
          id: randomUUID(),
          engagement_id: engagementId,
          sender_person_id: user.id,
          content: 'Both parties have confirmed that work has started.',
          is_system: true,
        },
        personId: user.id,
      },
    ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

    return NextResponse.json({ status: 'confirmed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update work started status';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
