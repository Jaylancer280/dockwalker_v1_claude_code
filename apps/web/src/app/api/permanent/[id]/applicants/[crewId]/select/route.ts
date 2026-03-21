import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/permanent/:id/applicants/:crewId/select
 * Employer selects a shortlisted candidate. Creates engagement, moves posting to in_negotiation.
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
    return NextResponse.json({ error: 'Only employers can select' }, { status: 403 });
  }

  try {
    // Validate posting ownership and status
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (posting.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot select when posting is ${posting.status}` },
        { status: 400 },
      );
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
    if (application.status !== 'shortlisted') {
      return NextResponse.json(
        { error: `Cannot select a ${application.status} application — must be shortlisted first` },
        { status: 400 },
      );
    }

    const engagementId = randomUUID();

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.SELECTED',
      aggregateId: `${crewId}:${postingId}`,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: {
        crew_person_id: crewId,
        permanent_posting_id: postingId,
        engagement_id: engagementId,
      },
      personId: user.id,
    });

    // Fetch the created engagement
    const { data: engagement } = await serviceClient
      .from('active_engagements')
      .select('id')
      .eq('permanent_posting_id', postingId)
      .eq('crew_person_id', crewId)
      .single();

    notifyOnEvent(
      serviceClient,
      'PERMANENT.SELECTED',
      { crew_person_id: crewId, permanent_posting_id: postingId, engagement_id: engagement?.id },
      user.id,
    );

    return NextResponse.json({
      success: true,
      engagementId: engagement?.id ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to select';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
