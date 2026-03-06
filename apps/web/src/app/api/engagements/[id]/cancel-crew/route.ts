import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/engagements/:id/cancel-crew
 * Crew cancels an active engagement post-acceptance.
 * Emits ENGAGEMENT.CANCELLED_BY_CREW.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'ENGAGEMENT.CANCELLED_BY_CREW',
      p_aggregate_id: `${user.id}:${engagement.daywork_id}`,
      p_aggregate_type: 'application',
      p_role_context: 'crew',
      p_payload: {
        engagement_id: engagementId,
        daywork_id: engagement.daywork_id,
        crew_person_id: user.id,
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
