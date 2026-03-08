import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/cancel
 * Cancel a daywork posting. Only the poster can cancel.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  // Verify the posting exists and belongs to this user
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, status')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'Not your posting' }, { status: 403 });
  }

  if (daywork.status !== 'active' && daywork.status !== 'in_progress') {
    return NextResponse.json(
      { error: `Cannot cancel a ${daywork.status} posting` },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.CANCELLED_BY_EMPLOYER',
      aggregateId: dayworkId,
      aggregateType: 'daywork',
      roleContext: 'employer',
      payload: {},
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
