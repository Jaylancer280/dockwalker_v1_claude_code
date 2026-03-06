import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/daywork/:id/applicants/:crewId/accept
 * Accept an applicant. Validates no date overlap, emits DAYWORK.ACCEPTED,
 * auto-supersedes overlapping pending applications.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; crewId: string }> },
) {
  const { id: dayworkId, crewId } = await params;
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, start_date, end_date, status')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json({ error: 'This posting is no longer active' }, { status: 400 });
  }

  // Verify application exists and is in an acceptable state
  const { data: application } = await supabase
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', crewId)
    .eq('daywork_id', dayworkId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (application.status !== 'applied' && application.status !== 'viewed') {
    return NextResponse.json(
      { error: `Cannot accept a ${application.status} application` },
      { status: 400 },
    );
  }

  // Check for double-booking (overlapping accepted engagements)
  const { data: overlap } = await serviceClient.rpc('check_no_overlap', {
    p_crew_person_id: crewId,
    p_start_date: daywork.start_date,
    p_end_date: daywork.end_date,
  });

  if (overlap === false) {
    return NextResponse.json(
      { error: 'This crew member has a conflicting engagement on those dates' },
      { status: 409 },
    );
  }

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'DAYWORK.ACCEPTED',
      p_aggregate_id: `${crewId}:${dayworkId}`,
      p_aggregate_type: 'application',
      p_role_context: 'employer',
      p_payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
        employer_person_id: user.id,
        start_date: daywork.start_date,
        end_date: daywork.end_date,
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
