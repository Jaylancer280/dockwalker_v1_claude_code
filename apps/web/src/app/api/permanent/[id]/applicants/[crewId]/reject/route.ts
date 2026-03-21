import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/permanent/:id/applicants/:crewId/reject
 * Employer rejects a permanent applicant.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; crewId: string }> },
) {
  const { id: postingId, crewId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can reject' }, { status: 403 });
  }

  try {
    // Validate posting ownership
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }

    // Validate application
    const { data: application } = await supabase
      .from('applications')
      .select('id, status')
      .eq('crew_person_id', crewId)
      .eq('permanent_posting_id', postingId)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    if (!['applied', 'shortlisted'].includes(application.status)) {
      return NextResponse.json(
        { error: `Cannot reject a ${application.status} application` },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.REJECTED',
      aggregateId: `${crewId}:${postingId}`,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: { crew_person_id: crewId, permanent_posting_id: postingId },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.REJECTED',
      { crew_person_id: crewId, permanent_posting_id: postingId },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reject';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
