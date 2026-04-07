import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/daywork/:id/applicants/:crewId/reject
 * Reject an applicant. Emits DAYWORK.REJECTED.
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
    return NextResponse.json({ error: 'Only employers can reject applicants' }, { status: 403 });
  }

  // Verify ownership
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
  }

  // Verify application exists and is rejectable
  // Use serviceClient: ownership verified above; RLS blocks agents.
  const { data: application } = await serviceClient
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
      { error: `Cannot reject a ${application.status} application` },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.REJECTED',
      aggregateId: `${crewId}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: person.current_hat as 'employer' | 'agent',
      payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'DAYWORK.REJECTED',
      { daywork_id: dayworkId, crew_person_id: crewId },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reject';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
