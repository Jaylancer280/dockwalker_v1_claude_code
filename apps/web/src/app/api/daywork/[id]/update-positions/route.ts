import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/update-positions
 * Update positions_available for a daywork posting.
 * Employer-only, owner-gated. Daywork must be 'active'.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id, status, positions_available, positions_filled')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this posting' }, { status: 403 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json(
      { error: 'Can only update positions on active postings' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const positionsAvailable = parseInt(body.positionsAvailable, 10);

  if (isNaN(positionsAvailable) || positionsAvailable < 1 || positionsAvailable > 20) {
    return NextResponse.json(
      { error: 'positionsAvailable must be between 1 and 20' },
      { status: 400 },
    );
  }

  if (positionsAvailable < daywork.positions_filled) {
    return NextResponse.json(
      { error: `Cannot reduce below filled count (${daywork.positions_filled})` },
      { status: 400 },
    );
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.POSITIONS_UPDATED',
      aggregateId: dayworkId,
      aggregateType: 'daywork',
      roleContext: 'employer',
      payload: {
        daywork_id: dayworkId,
        positions_available: positionsAvailable,
      },
      personId: user.id,
    });

    return NextResponse.json({
      success: true,
      positions_available: positionsAvailable,
      positions_filled: daywork.positions_filled,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update positions';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
