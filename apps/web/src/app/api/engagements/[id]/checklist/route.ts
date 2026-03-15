import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvents } from '@dockwalker/db';
import type { AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/engagements/:id/checklist
 * Employer sets or updates the pre-arrival checklist.
 * Emits CHECKLIST.SET + system MESSAGE.SENT.
 * Resets all crew acknowledgements when updated.
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
    return NextResponse.json({ error: 'Only the employer can set the checklist' }, { status: 403 });
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
  }

  if (items.length > 30) {
    return NextResponse.json({ error: 'Maximum 30 checklist items' }, { status: 400 });
  }

  for (const item of items) {
    if (!item.id || typeof item.id !== 'string') {
      return NextResponse.json({ error: 'Each item must have a string id' }, { status: 400 });
    }
    if (!item.label || typeof item.label !== 'string') {
      return NextResponse.json({ error: 'Each item must have a string label' }, { status: 400 });
    }
    if (!item.value || typeof item.value !== 'string') {
      return NextResponse.json({ error: 'Each item must have a string value' }, { status: 400 });
    }
    if (item.value.length > 500) {
      return NextResponse.json(
        { error: 'Item value must be 500 characters or fewer' },
        { status: 400 },
      );
    }
  }

  // Check for duplicate IDs
  const ids = items.map((i: { id: string }) => i.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Item IDs must be unique' }, { status: 400 });
  }

  try {
    // Check if checklist already exists (for system message wording)
    const { data: existing } = await supabase
      .from('engagement_checklists')
      .select('engagement_id')
      .eq('engagement_id', engagementId)
      .single();

    const isUpdate = !!existing;
    const systemContent = isUpdate
      ? 'Pre-arrival checklist has been updated'
      : 'Pre-arrival checklist has been set';

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'CHECKLIST.SET',
        aggregateId: engagementId,
        aggregateType: 'checklist',
        roleContext: 'employer',
        payload: {
          engagement_id: engagementId,
          items: items.map((i: { id: string; label: string; value: string }) => ({
            id: i.id,
            label: i.label,
            value: i.value,
          })),
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

    await appendEvents(serviceClient, events);

    notifyOnEvent(serviceClient, 'CHECKLIST.SET', { engagement_id: engagementId }, user.id);

    return NextResponse.json({ success: true, updated: isUpdate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to set checklist';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
