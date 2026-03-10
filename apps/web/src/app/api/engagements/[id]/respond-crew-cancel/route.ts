import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/respond-crew-cancel
 * Employer responds to a crew-initiated cancellation by choosing to relist or cancel the daywork.
 * Body: { action: 'relist' | 'cancel' }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, employer_person_id, daywork_id, status, cancelled_by')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Only the employer can respond' }, { status: 403 });
  }

  if (engagement.status !== 'cancelled' || engagement.cancelled_by !== 'crew') {
    return NextResponse.json(
      { error: 'This engagement was not cancelled by crew' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action !== 'relist' && action !== 'cancel') {
    return NextResponse.json({ error: 'action must be relist or cancel' }, { status: 400 });
  }

  // Check daywork is still in_progress (not already relisted or cancelled)
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, status, start_date')
    .eq('id', engagement.daywork_id)
    .single();

  if (!daywork || daywork.status !== 'in_progress') {
    return NextResponse.json(
      { error: 'Daywork is no longer available for relisting' },
      { status: 400 },
    );
  }

  try {
    if (action === 'relist') {
      const today = new Date().toISOString().split('T')[0];
      if (daywork.start_date < today) {
        return NextResponse.json(
          { error: 'Cannot relist — start date has already passed. Create a new posting instead.' },
          { status: 400 },
        );
      }

      await appendEvents(serviceClient, [
        {
          eventType: 'DAYWORK.RELISTED',
          aggregateId: engagement.daywork_id,
          aggregateType: 'daywork',
          roleContext: 'employer',
          payload: { daywork_id: engagement.daywork_id },
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
            content: 'Job has been relisted for new applicants.',
            is_system: true,
          },
          personId: user.id,
        },
      ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

      return NextResponse.json({ success: true, action: 'relisted' });
    }

    // action === 'cancel'
    await appendEvents(serviceClient, [
      {
        eventType: 'DAYWORK.CANCELLED_BY_EMPLOYER',
        aggregateId: engagement.daywork_id,
        aggregateType: 'daywork',
        roleContext: 'employer',
        payload: {},
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
          content: 'Job posting has been cancelled.',
          is_system: true,
        },
        personId: user.id,
      },
    ] satisfies AppendEventParams<keyof EventPayloadMap>[]);

    return NextResponse.json({ success: true, action: 'cancelled' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to respond';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
