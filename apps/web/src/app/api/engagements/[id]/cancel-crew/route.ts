import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/engagements/:id/cancel-crew
 * Crew cancels an active engagement post-acceptance.
 * Emits ENGAGEMENT.CANCELLED_BY_CREW.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    await appendEvent(serviceClient, {
      eventType: 'ENGAGEMENT.CANCELLED_BY_CREW',
      aggregateId: `${user.id}:${engagement.daywork_id}`,
      aggregateType: 'application',
      roleContext: 'crew',
      payload: {
        engagement_id: engagementId,
        daywork_id: engagement.daywork_id,
        crew_person_id: user.id,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
