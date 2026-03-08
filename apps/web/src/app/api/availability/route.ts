import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * GET /api/availability
 * Returns the authenticated crew member's availability windows
 * and their accepted engagements (blocked days).
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  // Get availability windows (only non-expired)
  const { data: windows, error: windowsError } = await supabase
    .from('availability_windows')
    .select('id, date, expires_at')
    .eq('person_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('date');

  if (windowsError) {
    return NextResponse.json({ error: windowsError.message }, { status: 500 });
  }

  // Get accepted engagements (blocked days)
  const { data: engagements, error: engError } = await supabase
    .from('active_engagements')
    .select('id, start_date, end_date, daywork_id, dayworks(yacht_roles(name))')
    .eq('crew_person_id', user.id)
    .eq('status', 'active');

  if (engError) {
    return NextResponse.json({ error: engError.message }, { status: 500 });
  }

  return NextResponse.json({
    windows: windows ?? [],
    engagements: engagements ?? [],
  });
}

/**
 * POST /api/availability
 * Set availability for a date range. Crew hat only.
 *
 * Body: {
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   expiresInDays?: number (default 7)
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can set availability' }, { status: 403 });
  }

  const body = await request.json();
  const { startDate, endDate, expiresInDays } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
  }

  // Max 60 days at once to prevent abuse
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays > 60) {
    return NextResponse.json({ error: 'Maximum 60 days per request' }, { status: 400 });
  }

  // Calculate expiry (default 7 days from now)
  const expDays = Math.min(Math.max(expiresInDays ?? 7, 1), 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expDays);

  try {
    await appendEvent(serviceClient, {
      eventType: 'AVAILABILITY.SET',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: 'crew',
      payload: {
        start_date: startDate,
        end_date: endDate,
        expires_at: expiresAt.toISOString(),
      },
      personId: user.id,
    });

    return NextResponse.json({
      success: true,
      daysSet: diffDays,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/availability
 * Clear availability for specific dates.
 *
 * Body: { dates: string[] } — array of YYYY-MM-DD
 */
export async function DELETE(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  const body = await request.json();
  const { dates } = body;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: 'dates array is required' }, { status: 400 });
  }

  const invalidDate = dates.some((date) => {
    if (typeof date !== 'string') {
      return true;
    }

    return Number.isNaN(new Date(date).getTime());
  });

  if (invalidDate) {
    return NextResponse.json(
      { error: 'All dates must be valid YYYY-MM-DD strings' },
      { status: 400 },
    );
  }

  const { error } = await serviceClient.rpc('clear_availability_dates', {
    p_person_id: user.id,
    p_dates: dates,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleared: dates.length });
}
