import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { randomUUID } from 'crypto';

const VALID_REASON_CATEGORIES = [
  'personal_reasons',
  'found_other_work',
  'unsafe_conditions',
  'other',
] as const;

/**
 * POST /api/engagements/:id/cancel-crew
 * Crew cancels an active engagement with structured reason.
 * Emits ENGAGEMENT.CANCELLED_BY_CREW + system message.
 * Daywork stays in_progress — employer decides whether to relist.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, daywork_id, status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id) {
    return NextResponse.json({ error: 'Only the crew member can cancel' }, { status: 403 });
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { reason_category, reason_text } = body;

  if (
    !reason_category ||
    !(VALID_REASON_CATEGORIES as readonly string[]).includes(reason_category)
  ) {
    return NextResponse.json(
      {
        error:
          'reason_category must be one of: personal_reasons, found_other_work, unsafe_conditions, other',
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

  try {
    const reasonLabels: Record<string, string> = {
      personal_reasons: 'Personal circumstances changed',
      found_other_work: 'Accepted another job',
      unsafe_conditions: 'Safety or working condition concerns',
      other: reason_text?.trim() ?? 'Other reason',
    };
    const systemContent = `Engagement cancelled by crew. Reason: ${reasonLabels[reason_category]}`;

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'ENGAGEMENT.CANCELLED_BY_CREW',
        aggregateId: `${user.id}:${engagement.daywork_id}`,
        aggregateType: 'application',
        roleContext: 'crew',
        payload: {
          engagement_id: engagementId,
          daywork_id: engagement.daywork_id,
          crew_person_id: user.id,
          reason_category: reason_category as
            | 'personal_reasons'
            | 'found_other_work'
            | 'unsafe_conditions'
            | 'other',
          reason_text: reason_category === 'other' ? reason_text.trim() : undefined,
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
          content: systemContent,
          is_system: true,
        },
        personId: user.id,
      },
    ];

    await appendEvents(serviceClient, events);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
