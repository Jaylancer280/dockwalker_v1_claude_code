import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/daywork/:id/complete
 * Employer marks a daywork posting as completed.
 * Emits DAYWORK.COMPLETED. Updates daywork status and all active engagements.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

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

  if (daywork.status !== 'in_progress') {
    return NextResponse.json(
      { error: 'Only in-progress postings can be completed' },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.COMPLETED',
      aggregateId: dayworkId,
      aggregateType: 'daywork',
      roleContext: 'employer',
      payload: { daywork_id: dayworkId },
      personId: user.id,
    });

    notifyOnEvent(serviceClient, 'DAYWORK.COMPLETED', { daywork_id: dayworkId }, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to complete';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
