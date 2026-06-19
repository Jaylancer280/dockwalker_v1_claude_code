import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/engagements/:id/confirm-completion
 * Crew confirms or disputes that the daywork was completed.
 * Body: { confirmed: boolean }
 * Both responses are recorded in the ledger. The daywork remains completed regardless.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, daywork_id, status, crew_completion_status')
    .eq('id', engagementId)
    .not('daywork_id', 'is', null)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the crew member can confirm completion' },
      { status: 403 },
    );
  }

  if (engagement.status !== 'completed') {
    return NextResponse.json({ error: 'Engagement is not completed' }, { status: 400 });
  }

  if (engagement.crew_completion_status !== null) {
    return NextResponse.json(
      { error: `You have already ${engagement.crew_completion_status} this completion` },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.confirmed !== 'boolean') {
    return NextResponse.json(
      { error: 'confirmed must be a boolean (true or false)' },
      { status: 400 },
    );
  }
  const confirmed: boolean = body.confirmed;
  const eventType = confirmed
    ? ('ENGAGEMENT.COMPLETION_CONFIRMED' as const)
    : ('ENGAGEMENT.COMPLETION_DISPUTED' as const);

  try {
    await appendEvent(serviceClient, {
      eventType,
      aggregateId: engagementId,
      aggregateType: 'engagement',
      roleContext: 'crew',
      payload: {
        engagement_id: engagementId,
        daywork_id: engagement.daywork_id,
        crew_person_id: user.id,
        confirmed,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true, status: confirmed ? 'confirmed' : 'disputed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to confirm completion';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
