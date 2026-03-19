import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

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
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can accept applicants' }, { status: 403 });
  }

  // Verify ownership
  const { data: daywork } = await supabase
    .from('dayworks')
    .select(
      'id, poster_person_id, start_date, end_date, status, positions_available, positions_filled',
    )
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

  if (daywork.positions_filled >= daywork.positions_available) {
    return NextResponse.json({ error: 'All positions are filled' }, { status: 400 });
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

  if (
    application.status !== 'applied' &&
    application.status !== 'viewed' &&
    application.status !== 'shortlisted'
  ) {
    return NextResponse.json(
      { error: `Cannot accept a ${application.status} application` },
      { status: 400 },
    );
  }

  // Check for double-booking (overlapping accepted engagements)
  const { data: overlap, error: overlapError } = await serviceClient.rpc('check_no_overlap', {
    p_crew_person_id: crewId,
    p_daywork_id: dayworkId,
  });

  if (overlapError) {
    return NextResponse.json({ error: overlapError.message }, { status: 500 });
  }

  if (overlap === false) {
    return NextResponse.json(
      { error: 'This crew member has a conflicting engagement on those dates' },
      { status: 409 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.ACCEPTED',
      aggregateId: `${crewId}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: person.current_hat as 'employer' | 'agent',
      payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
        employer_person_id: user.id,
        start_date: daywork.start_date,
        end_date: daywork.end_date,
      },
      personId: user.id,
    });

    // Fetch the newly created engagement ID for the client and for push deep-link
    const { data: engagement } = await serviceClient
      .from('active_engagements')
      .select('id')
      .eq('crew_person_id', crewId)
      .eq('daywork_id', dayworkId)
      .single();

    notifyOnEvent(
      serviceClient,
      'DAYWORK.ACCEPTED',
      {
        daywork_id: dayworkId,
        crew_person_id: crewId,
        employer_person_id: user.id,
        engagement_id: engagement?.id,
      },
      user.id,
    );

    return NextResponse.json({
      success: true,
      engagementId: engagement?.id ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
