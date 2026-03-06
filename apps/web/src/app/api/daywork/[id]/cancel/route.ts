import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/daywork/:id/cancel
 * Cancel a daywork posting. Only the poster can cancel.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the posting exists and belongs to this user
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, status')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'Not your posting' }, { status: 403 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot cancel a ${daywork.status} posting` },
      { status: 400 },
    );
  }

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'DAYWORK.CANCELLED_BY_EMPLOYER',
      p_aggregate_id: dayworkId,
      p_aggregate_type: 'daywork',
      p_role_context: 'employer',
      p_payload: {},
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
