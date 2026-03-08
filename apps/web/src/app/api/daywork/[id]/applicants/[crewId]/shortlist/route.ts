import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/applicants/:crewId/shortlist
 * Shortlist an applicant. Emits DAYWORK.SHORTLISTED.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; crewId: string }> },
) {
  const { id: dayworkId, crewId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  // Verify ownership
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
    return NextResponse.json({ error: 'This posting is no longer active' }, { status: 400 });
  }

  // Verify application exists and is in a shortlistable state
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
      { error: `Cannot shortlist a ${application.status} application` },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.SHORTLISTED',
      aggregateId: `${crewId}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: 'employer',
      payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to shortlist';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
