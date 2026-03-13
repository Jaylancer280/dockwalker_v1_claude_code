import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/engagements/:id/checklist/toggle
 * Crew toggles acknowledgement of a single checklist item.
 * Emits CHECKLIST.ITEM_TOGGLED.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the crew member can toggle checklist items' },
      { status: 403 },
    );
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { item_id, checked } = body;

  if (!item_id || typeof item_id !== 'string') {
    return NextResponse.json({ error: 'item_id must be a string' }, { status: 400 });
  }

  if (typeof checked !== 'boolean') {
    return NextResponse.json({ error: 'checked must be a boolean' }, { status: 400 });
  }

  // Verify the item exists in the checklist
  const { data: checklist } = await supabase
    .from('engagement_checklists')
    .select('items')
    .eq('engagement_id', engagementId)
    .single();

  if (!checklist) {
    return NextResponse.json({ error: 'No checklist exists for this engagement' }, { status: 404 });
  }

  const items = checklist.items as Array<{ id: string }>;
  if (!items.some((i) => i.id === item_id)) {
    return NextResponse.json({ error: 'Item not found in checklist' }, { status: 400 });
  }

  try {
    await appendEvent<'CHECKLIST.ITEM_TOGGLED'>(serviceClient, {
      eventType: 'CHECKLIST.ITEM_TOGGLED',
      aggregateId: engagementId,
      aggregateType: 'checklist',
      roleContext: 'crew',
      payload: {
        engagement_id: engagementId,
        item_id,
        checked,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to toggle item';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
