import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { requireSubscription } from '@/lib/require-subscription';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/permanent/:id/applicants/:crewId/shortlist
 * Employer shortlists a permanent applicant. Capped by shortlist_cap.
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
    return NextResponse.json({ error: 'Only employers can shortlist' }, { status: 403 });
  }

  try {
    // Validate posting ownership
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status, shortlist_cap')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (!['active', 'in_negotiation'].includes(posting.status)) {
      return NextResponse.json({ error: 'Posting is not active' }, { status: 400 });
    }

    // Validate application
    // Use serviceClient: ownership verified above; RLS blocks agents.
    const { data: application } = await serviceClient
      .from('applications')
      .select('id, status')
      .eq('crew_person_id', crewId)
      .eq('permanent_posting_id', postingId)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    if (application.status !== 'applied') {
      return NextResponse.json(
        { error: `Cannot shortlist a ${application.status} application` },
        { status: 400 },
      );
    }

    // Check shortlist cap — tier-gated
    const subResult = await requireSubscription(supabase, user.id, 'employer_pro');
    const tierMax = subResult.ok ? 8 : 3;
    const effectiveCap = Math.min(posting.shortlist_cap, tierMax);

    const { count } = await serviceClient
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('permanent_posting_id', postingId)
      .in('status', ['shortlisted', 'selected']);

    if ((count ?? 0) >= effectiveCap) {
      return NextResponse.json(
        {
          error: `Shortlist is full (${count} of ${effectiveCap})`,
          ...(effectiveCap < posting.shortlist_cap
            ? { upgrade_url: '/billing', tier_max: tierMax }
            : {}),
        },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.SHORTLISTED',
      aggregateId: `${crewId}:${postingId}`,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: { crew_person_id: crewId, permanent_posting_id: postingId },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'PERMANENT.SHORTLISTED',
      { crew_person_id: crewId, permanent_posting_id: postingId },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to shortlist';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
