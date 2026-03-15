import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/daywork/:id/apply
 * Crew applies to a daywork posting.
 * Body: { message?: string } — optional 250-char message
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayworkId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can apply' }, { status: 403 });
  }

  // Validate daywork exists and is active
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, status, poster_person_id')
    .eq('id', dayworkId)
    .single();

  if (!daywork) {
    return NextResponse.json({ error: 'Daywork not found' }, { status: 404 });
  }

  if (daywork.status !== 'active') {
    return NextResponse.json({ error: 'This posting is no longer active' }, { status: 400 });
  }

  if (daywork.poster_person_id === user.id) {
    return NextResponse.json({ error: 'Cannot apply to your own posting' }, { status: 400 });
  }

  // Check for existing application
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', user.id)
    .eq('daywork_id', dayworkId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `You already have a ${existing.status} application for this posting` },
      { status: 409 },
    );
  }

  // Enforce availability requirement: crew must have active (non-expired, non-not_available) windows
  const { data: availWindows } = await supabase
    .from('availability_windows')
    .select('id, not_available')
    .eq('person_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  const hasNotAvailable = availWindows?.some((w) => w.not_available);
  const hasAvailable = availWindows?.some((w) => !w.not_available);

  if (hasNotAvailable || !hasAvailable) {
    return NextResponse.json(
      { error: 'You must set your availability before applying' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.slice(0, 250) : undefined;
  const applicationId = randomUUID();

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.APPLIED',
      aggregateId: `${user.id}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: 'crew',
      payload: {
        id: applicationId,
        daywork_id: dayworkId,
        crew_person_id: user.id,
        ...(message ? { message } : {}),
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'DAYWORK.APPLIED',
      { daywork_id: dayworkId, crew_person_id: user.id },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to apply';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
