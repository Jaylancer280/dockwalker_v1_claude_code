import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents, checkNoOverlapExcluding } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/respond-postponement
 * Crew accepts or rejects an employer's postponement proposal.
 *
 * On rejection: cancels engagement but does NOT auto-relist.
 * Employer can choose to relist via the relist-with-dates endpoint.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select(
      'id, crew_person_id, employer_person_id, daywork_id, status, postponement_status, proposed_start_date, proposed_end_date, proposed_working_days',
    )
    .eq('id', engagementId)
    .not('daywork_id', 'is', null)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the crew member can respond to postponement' },
      { status: 403 },
    );
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  if (engagement.postponement_status !== 'proposed') {
    return NextResponse.json({ error: 'No pending postponement proposal' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.accepted !== 'boolean') {
    return NextResponse.json({ error: 'accepted must be a boolean' }, { status: 400 });
  }

  try {
    if (body.accepted) {
      const noOverlap = await checkNoOverlapExcluding(
        serviceClient,
        engagement.crew_person_id,
        engagement.proposed_start_date,
        engagement.proposed_end_date,
        engagementId,
      );

      if (!noOverlap) {
        await appendEvents(serviceClient, [
          {
            eventType: 'ENGAGEMENT.POSTPONEMENT_REJECTED',
            aggregateId: engagementId,
            aggregateType: 'engagement',
            roleContext: 'crew',
            payload: {
              engagement_id: engagementId,
              daywork_id: engagement.daywork_id,
              crew_person_id: engagement.crew_person_id,
            },
            personId: user.id,
          },
          {
            eventType: 'MESSAGE.SENT',
            aggregateId: engagementId,
            aggregateType: 'message',
            roleContext: 'crew',
            payload: {
              id: randomUUID(),
              engagement_id: engagementId,
              sender_person_id: user.id,
              content:
                'Date change could not be accepted due to a scheduling conflict. This engagement has been cancelled.',
              is_system: true,
            },
            personId: user.id,
          },
        ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

        return NextResponse.json({ outcome: 'conflict_cancelled' });
      }

      await appendEvents(serviceClient, [
        {
          eventType: 'ENGAGEMENT.POSTPONEMENT_ACCEPTED',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'crew',
          payload: {
            engagement_id: engagementId,
            daywork_id: engagement.daywork_id,
            new_start_date: engagement.proposed_start_date,
            new_end_date: engagement.proposed_end_date,
            new_working_days: engagement.proposed_working_days,
          },
          personId: user.id,
        },
        {
          eventType: 'MESSAGE.SENT',
          aggregateId: engagementId,
          aggregateType: 'message',
          roleContext: 'crew',
          payload: {
            id: randomUUID(),
            engagement_id: engagementId,
            sender_person_id: user.id,
            content: `Date change accepted. New dates: ${engagement.proposed_start_date} to ${engagement.proposed_end_date} (${engagement.proposed_working_days} working day${engagement.proposed_working_days !== 1 ? 's' : ''}).`,
            is_system: true,
          },
          personId: user.id,
        },
      ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

      return NextResponse.json({ outcome: 'accepted' });
    } else {
      await appendEvents(serviceClient, [
        {
          eventType: 'ENGAGEMENT.POSTPONEMENT_REJECTED',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'crew',
          payload: {
            engagement_id: engagementId,
            daywork_id: engagement.daywork_id,
            crew_person_id: engagement.crew_person_id,
          },
          personId: user.id,
        },
        {
          eventType: 'MESSAGE.SENT',
          aggregateId: engagementId,
          aggregateType: 'message',
          roleContext: 'crew',
          payload: {
            id: randomUUID(),
            engagement_id: engagementId,
            sender_person_id: user.id,
            content: 'Crew rejected the proposed date change. This engagement has been cancelled.',
            is_system: true,
          },
          personId: user.id,
        },
      ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

      return NextResponse.json({ outcome: 'rejected' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to respond to postponement';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
