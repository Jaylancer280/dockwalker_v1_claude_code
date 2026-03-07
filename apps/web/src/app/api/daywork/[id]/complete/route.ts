import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/daywork/:id/complete
 * Employer marks a daywork posting as completed.
 * Emits DAYWORK.COMPLETED. Updates daywork status and all active engagements.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, status')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json({ error: 'Only active postings can be completed' }, { status: 400 });
  }

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'DAYWORK.COMPLETED',
      p_aggregate_id: dayworkId,
      p_aggregate_type: 'daywork',
      p_role_context: 'employer',
      p_payload: { daywork_id: dayworkId },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to complete';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
