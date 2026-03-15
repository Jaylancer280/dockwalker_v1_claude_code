import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/extend
 * Extend an active daywork posting's end_date.
 * Only the posting owner (employer/agent) can extend.
 *
 * Body: {
 *   endDate: string (YYYY-MM-DD, required, must be >= today),
 *   workingDays?: number,
 *   workingDayDates?: string[]
 * }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json(
      { error: 'Only employers and agents can extend daywork' },
      { status: 403 },
    );
  }

  // Verify ownership and active status
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, status, start_date, end_date')
    .eq('id', dayworkId)
    .eq('poster_person_id', user.id)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json({ error: 'Only active daywork can be extended' }, { status: 400 });
  }

  const body = await request.json();
  const { endDate, workingDays, workingDayDates } = body;

  if (!endDate) {
    return NextResponse.json({ error: 'endDate is required' }, { status: 400 });
  }

  // Validate endDate is a valid date
  const newEnd = new Date(endDate);
  if (isNaN(newEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  // endDate must be >= today (UTC)
  const todayStr = new Date().toISOString().slice(0, 10);
  if (endDate < todayStr) {
    return NextResponse.json({ error: 'End date cannot be in the past' }, { status: 400 });
  }

  // endDate must be >= startDate
  if (endDate < daywork.start_date) {
    return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    daywork_id: dayworkId,
    end_date: endDate,
  };

  if (workingDays !== undefined) {
    payload.working_days = workingDays;
  }

  if (workingDayDates && Array.isArray(workingDayDates) && workingDayDates.length > 0) {
    payload.working_day_dates = workingDayDates;
    payload.working_days = workingDayDates.length;
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.EXTENDED',
      aggregateId: dayworkId,
      aggregateType: 'daywork',
      roleContext: person.current_hat,
      payload: payload as Parameters<typeof appendEvent<'DAYWORK.EXTENDED'>>[1]['payload'],
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extend daywork';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
