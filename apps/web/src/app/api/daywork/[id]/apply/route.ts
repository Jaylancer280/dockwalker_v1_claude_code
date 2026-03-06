import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/daywork/:id/apply
 * Crew applies to a daywork posting.
 * Body: { message?: string } — optional 250-char message
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

  const { data: person } = await supabase
    .from('persons')
    .select('current_hat')
    .eq('id', user.id)
    .single();

  if (!person || person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can apply' }, { status: 403 });
  }

  // Validate daywork exists and is active
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, status, poster_person_id')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json({ error: 'This posting is no longer active' }, { status: 400 });
  }

  if (daywork.poster_person_id === user.id) {
    return NextResponse.json({ error: 'Cannot apply to your own posting' }, { status: 400 });
  }

  // Check for existing application
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', user.id)
    .eq('daywork_id', dayworkId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `You already have a ${existing.status} application for this posting` },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.slice(0, 250) : undefined;

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'DAYWORK.APPLIED',
      p_aggregate_id: `${user.id}:${dayworkId}`,
      p_aggregate_type: 'application',
      p_role_context: 'crew',
      p_payload: {
        daywork_id: dayworkId,
        crew_person_id: user.id,
        ...(message ? { message } : {}),
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to apply';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
