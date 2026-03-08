import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/withdraw
 * Crew withdraws a pending application.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  // Verify application exists and is in a withdrawable state
  const { data: application } = await supabase
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', user.id)
    .eq('daywork_id', dayworkId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'No application found' }, { status: 404 });
  }

  if (application.status !== 'applied') {
    return NextResponse.json(
      { error: `Cannot withdraw a ${application.status} application` },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'APPLICATION.WITHDRAWN',
      aggregateId: `${user.id}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: 'crew',
      payload: {
        daywork_id: dayworkId,
        crew_person_id: user.id,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to withdraw';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
