import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

const VALID_REASON_CATEGORIES = [
  'vessel_leaving',
  'crew_requirements_changed',
  'vessel_operational',
  'other',
] as const;
const VALID_RELIST_CATEGORIES = [
  'wrong_crew',
  'requirements_changed',
  'different_skills',
  'relist_other',
] as const;

/**
 * POST /api/engagements/:id/cancel-employer
 * Employer cancels an active engagement with structured reason.
 * Emits ENGAGEMENT.CANCELLED_BY_EMPLOYER, system message, and optionally DAYWORK.RELISTED or DAYWORK.CANCELLED_BY_EMPLOYER.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, daywork_id, status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Only the employer can cancel' }, { status: 403 });
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    reason_category,
    reason_text,
    relist_requested,
    relist_reason_category,
    relist_reason_text,
  } = body;

  // Validate reason_category
  if (
    !reason_category ||
    !(VALID_REASON_CATEGORIES as readonly string[]).includes(reason_category)
  ) {
    return NextResponse.json(
      {
        error:
          'reason_category must be one of: vessel_leaving, crew_requirements_changed, vessel_operational, other',
      },
      { status: 400 },
    );
  }

  if (
    reason_category === 'other' &&
    (!reason_text || typeof reason_text !== 'string' || reason_text.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: 'reason_text is required when reason_category is other' },
      { status: 400 },
    );
  }

  if (reason_text && typeof reason_text === 'string' && reason_text.trim().length > 250) {
    return NextResponse.json(
      { error: 'reason_text must be 250 characters or fewer' },
      { status: 400 },
    );
  }

  if (relist_requested !== undefined && typeof relist_requested !== 'boolean') {
    return NextResponse.json({ error: 'relist_requested must be a boolean' }, { status: 400 });
  }

  if (relist_requested) {
    if (
      !relist_reason_category ||
      !(VALID_RELIST_CATEGORIES as readonly string[]).includes(relist_reason_category)
    ) {
      return NextResponse.json(
        { error: 'relist_reason_category is required when relist_requested is true' },
        { status: 400 },
      );
    }
    if (
      relist_reason_category === 'relist_other' &&
      (!relist_reason_text ||
        typeof relist_reason_text !== 'string' ||
        relist_reason_text.trim().length === 0)
    ) {
      return NextResponse.json(
        { error: 'relist_reason_text is required when relist_reason_category is relist_other' },
        { status: 400 },
      );
    }
    if (
      relist_reason_text &&
      typeof relist_reason_text === 'string' &&
      relist_reason_text.trim().length > 250
    ) {
      return NextResponse.json(
        { error: 'relist_reason_text must be 250 characters or fewer' },
        { status: 400 },
      );
    }
  }

  try {
    const reasonLabels: Record<string, string> = {
      vessel_leaving: 'Vessel leaving port earlier than expected',
      crew_requirements_changed: 'Change in crew requirements',
      vessel_operational: 'Vessel operational issues',
      other: reason_text?.trim() ?? 'Other reason',
    };
    const systemContent = `Engagement cancelled by employer. Reason: ${reasonLabels[reason_category]}`;

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
        aggregateId: `${engagement.crew_person_id}:${engagement.daywork_id}`,
        aggregateType: 'application',
        roleContext: 'employer',
        payload: {
          engagement_id: engagementId,
          daywork_id: engagement.daywork_id,
          crew_person_id: engagement.crew_person_id,
          reason_category: reason_category as
            | 'vessel_leaving'
            | 'crew_requirements_changed'
            | 'vessel_operational'
            | 'other',
          reason_text: reason_category === 'other' ? reason_text.trim() : undefined,
          relist_requested,
          relist_reason_category: relist_requested ? relist_reason_category : undefined,
          relist_reason_text:
            relist_requested && relist_reason_category === 'relist_other'
              ? relist_reason_text.trim()
              : undefined,
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
          content: systemContent,
          is_system: true,
        },
        personId: user.id,
      },
    ];

    let relisted = false;

    // Check if other active engagements exist for this daywork (multi-crew)
    const { count: otherActiveCount } = await serviceClient
      .from('active_engagements')
      .select('id', { count: 'exact', head: true })
      .eq('daywork_id', engagement.daywork_id)
      .eq('status', 'active')
      .neq('id', engagementId);

    if ((otherActiveCount ?? 0) > 0) {
      // Multi-crew with remaining active engagements: just cancel this one, skip relist/cancel question
      // Daywork stays in_progress
    } else if (relist_requested) {
      const { data: daywork } = await supabase
        .from('dayworks')
        .select('start_date')
        .eq('id', engagement.daywork_id)
        .single();

      const today = new Date().toISOString().split('T')[0];
      if (daywork && daywork.start_date >= today) {
        events.push({
          eventType: 'DAYWORK.RELISTED',
          aggregateId: engagement.daywork_id,
          aggregateType: 'daywork',
          roleContext: 'employer',
          payload: { daywork_id: engagement.daywork_id },
          personId: user.id,
        });
        relisted = true;
      }
    } else {
      events.push({
        eventType: 'DAYWORK.CANCELLED_BY_EMPLOYER',
        aggregateId: engagement.daywork_id,
        aggregateType: 'daywork',
        roleContext: 'employer',
        payload: {},
        personId: user.id,
      });
    }

    await appendEvents(serviceClient, events);

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

    return NextResponse.json({ success: true, relisted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
