import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents, checkNoOverlapExcluding } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/propose-postponement
 * Employer proposes new dates for an active engagement.
 *
 * Body: { start_date, end_date, working_days, confirm_conflict?: boolean }
 *
 * - Once-only: postponement can only be used once per engagement.
 * - If crew has a conflict and confirm_conflict is not set, returns { outcome: 'conflict' }.
 * - If crew has a conflict and confirm_conflict is true, cancels engagement and relists with new dates.
 * - If no conflict, sends proposal to crew via system message.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select(
      'id, crew_person_id, employer_person_id, daywork_id, status, postponement_status, work_started_status',
    )
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.employer_person_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the employer can propose postponement' },
      { status: 403 },
    );
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  // Block if work has started (confirmed by both parties)
  if (engagement.work_started_status === 'confirmed') {
    return NextResponse.json(
      { error: 'Cannot postpone — both parties have confirmed that work has started.' },
      { status: 400 },
    );
  }

  // Once-only: if postponement was ever used (any status), block
  if (engagement.postponement_status !== null) {
    return NextResponse.json(
      {
        error:
          'Postponement can only be used once per engagement. To change dates again, please cancel the engagement.',
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { start_date, end_date, working_days, confirm_conflict } = body;

  // Validate dates
  if (!start_date || !end_date || typeof start_date !== 'string' || typeof end_date !== 'string') {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  if (start_date < today) {
    return NextResponse.json(
      { error: 'start_date must be today or in the future' },
      { status: 400 },
    );
  }

  if (end_date < start_date) {
    return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 });
  }

  if (!Number.isInteger(working_days) || working_days < 1) {
    return NextResponse.json({ error: 'working_days must be a positive integer' }, { status: 400 });
  }

  // Check working_days fits within the date span
  const startMs = new Date(start_date).getTime();
  const endMs = new Date(end_date).getTime();
  const spanDays = Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
  if (working_days > spanDays) {
    return NextResponse.json(
      { error: `working_days (${working_days}) exceeds the date span (${spanDays} days)` },
      { status: 400 },
    );
  }

  try {
    // Check for overlap with crew's other engagements
    const noOverlap = await checkNoOverlapExcluding(
      serviceClient,
      engagement.crew_person_id,
      start_date,
      end_date,
      engagementId,
    );

    if (!noOverlap) {
      if (!confirm_conflict) {
        return NextResponse.json({ outcome: 'conflict' });
      }

      // Employer confirmed: cancel engagement and relist with new dates (atomic)
      await appendEvents(serviceClient, [
        {
          eventType: 'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
          aggregateId: `${engagement.crew_person_id}:${engagement.daywork_id}`,
          aggregateType: 'application',
          roleContext: 'employer',
          payload: {
            engagement_id: engagementId,
            daywork_id: engagement.daywork_id,
            crew_person_id: engagement.crew_person_id,
            reason_category: 'other',
            reason_text: 'Postponement dates conflict with crew schedule',
            relist_requested: true,
            relist_reason_category: 'requirements_changed',
          },
          personId: user.id,
        },
        {
          eventType: 'DAYWORK.RELISTED',
          aggregateId: engagement.daywork_id,
          aggregateType: 'daywork',
          roleContext: 'employer',
          payload: { daywork_id: engagement.daywork_id, start_date, end_date, working_days },
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
            content:
              'Employer proposed new dates but they conflict with your schedule. This engagement has been cancelled and the job relisted.',
            is_system: true,
          },
          personId: user.id,
        },
      ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

      notifyOnEvent(
        serviceClient,
        'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
        {
          engagement_id: engagementId,
          daywork_id: engagement.daywork_id,
          crew_person_id: engagement.crew_person_id,
        },
        user.id,
      );

      return NextResponse.json({ outcome: 'conflict_confirmed' });
    }

    // No overlap: propose dates (atomic)
    await appendEvents(serviceClient, [
      {
        eventType: 'ENGAGEMENT.POSTPONEMENT_PROPOSED',
        aggregateId: engagementId,
        aggregateType: 'engagement',
        roleContext: 'employer',
        payload: {
          engagement_id: engagementId,
          daywork_id: engagement.daywork_id,
          crew_person_id: engagement.crew_person_id,
          proposed_start_date: start_date,
          proposed_end_date: end_date,
          proposed_working_days: working_days,
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
          content: `Employer has proposed new dates: ${start_date} to ${end_date} (${working_days} working day${working_days !== 1 ? 's' : ''}). Please approve or reject this change.`,
          is_system: true,
        },
        personId: user.id,
      },
    ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

    notifyOnEvent(
      serviceClient,
      'ENGAGEMENT.POSTPONEMENT_PROPOSED',
      {
        engagement_id: engagementId,
        daywork_id: engagement.daywork_id,
        crew_person_id: engagement.crew_person_id,
      },
      user.id,
    );

    return NextResponse.json({ outcome: 'proposed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to propose postponement';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
