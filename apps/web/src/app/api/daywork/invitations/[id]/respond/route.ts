import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/daywork/invitations/:id/respond
 * Crew accepts or declines an invitation.
 * Accept: appends INVITATION_ACCEPTED + APPLIED atomically.
 * Decline: appends INVITATION_DECLINED.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: invitationId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can respond to invitations' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 });
  }

  // Fetch invitation and verify ownership
  const { data: invitation } = await supabase
    .from('daywork_invitations')
    .select('id, daywork_id, crew_person_id, status')
    .eq('id', invitationId)
    .single();

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.crew_person_id !== user.id) {
    return NextResponse.json({ error: 'Not your invitation' }, { status: 403 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
  }

  // Check daywork is still active and has capacity
  const { data: daywork } = await supabase
    .from('dayworks')
    .select(
      'id, status, start_date, end_date, positions_filled, positions_available, poster_person_id',
    )
    .eq('id', invitation.daywork_id)
    .single();

  if (!daywork || daywork.status !== 'active') {
    return NextResponse.json({ error: 'This job is no longer available' }, { status: 400 });
  }

  // Reject if start date has already passed
  if (action === 'accept' && daywork.start_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (daywork.start_date < today) {
      return NextResponse.json({ error: 'This job has already started' }, { status: 400 });
    }
  }

  if (action === 'decline') {
    try {
      await appendEvent(serviceClient, {
        eventType: 'DAYWORK.INVITATION_DECLINED',
        aggregateId: invitationId,
        aggregateType: 'invitation',
        roleContext: 'crew',
        payload: {
          daywork_id: invitation.daywork_id,
          invitation_id: invitationId,
        },
        personId: user.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invitation';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Accept flow: check crew has availability
  const { data: availWindows } = await supabase
    .from('availability_windows')
    .select('id')
    .eq('person_id', user.id)
    .eq('not_available', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (!availWindows || availWindows.length === 0) {
    return NextResponse.json(
      { error: 'Set your availability before accepting an invitation' },
      { status: 400 },
    );
  }

  // Check for double-booking (overlapping accepted engagements)
  const { data: overlap, error: overlapError } = await serviceClient.rpc('check_no_overlap', {
    p_crew_person_id: user.id,
    p_daywork_id: invitation.daywork_id,
  });

  if (overlapError) {
    return NextResponse.json({ error: overlapError.message }, { status: 500 });
  }

  if (overlap === false) {
    return NextResponse.json(
      { error: 'You have an overlapping engagement for these dates' },
      { status: 409 },
    );
  }

  // Check positions not already full
  if ((daywork.positions_filled ?? 0) >= (daywork.positions_available ?? 1)) {
    return NextResponse.json({ error: 'position_filled' }, { status: 409 });
  }

  // Append INVITATION_ACCEPTED — creates engagement directly via projection
  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.INVITATION_ACCEPTED',
      aggregateId: invitationId,
      aggregateType: 'invitation',
      roleContext: 'crew',
      payload: {
        daywork_id: invitation.daywork_id,
        invitation_id: invitationId,
        crew_person_id: user.id,
        employer_person_id: daywork.poster_person_id,
        start_date: daywork.start_date,
        end_date: daywork.end_date,
      },
      personId: user.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Fetch the newly created engagement
  const { data: engagement } = await serviceClient
    .from('active_engagements')
    .select('id')
    .eq('crew_person_id', user.id)
    .eq('daywork_id', invitation.daywork_id)
    .eq('status', 'active')
    .single();

  const engagementId = engagement?.id ?? null;

  notifyOnEvent(
    serviceClient,
    'DAYWORK.INVITATION_ACCEPTED',
    {
      daywork_id: invitation.daywork_id,
      crew_person_id: user.id,
      engagement_id: engagementId,
    },
    user.id,
  );

  return NextResponse.json({ success: true, engagementId });
}
