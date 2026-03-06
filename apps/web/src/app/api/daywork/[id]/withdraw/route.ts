import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/daywork/:id/withdraw
 * Crew withdraws a pending application.
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

  // Verify application exists and is in a withdrawable state
  const { data: application } = await supabase
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', user.id)
    .eq('daywork_id', dayworkId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'No application found' }, { status: 404 });
  }

  if (application.status !== 'applied') {
    return NextResponse.json(
      { error: `Cannot withdraw a ${application.status} application` },
      { status: 400 },
    );
  }

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'APPLICATION.WITHDRAWN',
      p_aggregate_id: `${user.id}:${dayworkId}`,
      p_aggregate_type: 'application',
      p_role_context: 'crew',
      p_payload: {
        daywork_id: dayworkId,
        crew_person_id: user.id,
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to withdraw';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
