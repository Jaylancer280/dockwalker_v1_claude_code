import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/daywork/:id/invite
 * Send an invitation to a crew member for this daywork posting.
 * Employer/agent only (must own the posting). Max 2 pending invitations.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'employer' && person.current_hat !== 'agent') {
      return NextResponse.json({ error: 'Employer or agent role required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const crewPersonId = body.crewPersonId as string | undefined;

    if (!crewPersonId) {
      return NextResponse.json({ error: 'crewPersonId is required' }, { status: 400 });
    }

    // Verify daywork ownership and active status
    const { data: daywork } = await supabase
      .from('dayworks')
      .select('id, poster_person_id, status, positions_available')
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

    // Verify crew person exists and has a crew profile
    const { data: crewProfile } = await supabase
      .from('profiles')
      .select('person_id')
      .eq('person_id', crewPersonId)
      .single();

    if (!crewProfile) {
      return NextResponse.json({ error: 'Crew member not found' }, { status: 400 });
    }

    // Check for existing application
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('daywork_id', dayworkId)
      .eq('crew_person_id', crewPersonId)
      .single();

    if (existingApp) {
      return NextResponse.json(
        { error: 'Crew member has already applied to this job' },
        { status: 400 },
      );
    }

    // Check for existing invitation
    const { data: existingInvite } = await supabase
      .from('daywork_invitations')
      .select('id')
      .eq('daywork_id', dayworkId)
      .eq('crew_person_id', crewPersonId)
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Crew member has already been invited' }, { status: 400 });
    }

    // Enforce 2-invitation limit
    const { count } = await supabase
      .from('daywork_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('daywork_id', dayworkId)
      .eq('status', 'pending');

    const invitationLimit = (daywork.positions_available ?? 1) + 2;
    if ((count ?? 0) >= invitationLimit) {
      return NextResponse.json(
        { error: `Invitation limit reached (max ${invitationLimit})` },
        { status: 400 },
      );
    }

    // Append DAYWORK.INVITED event
    const invitationId = crypto.randomUUID();
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.INVITED',
      aggregateId: invitationId,
      aggregateType: 'invitation',
      roleContext: person.current_hat,
      payload: {
        daywork_id: dayworkId,
        crew_person_id: crewPersonId,
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'DAYWORK.INVITED',
      { daywork_id: dayworkId, crew_person_id: crewPersonId },
      user.id,
    );

    return NextResponse.json(
      { invitation: { id: invitationId, status: 'pending' } },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
