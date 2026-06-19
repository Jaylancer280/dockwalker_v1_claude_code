import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/permanent/:id/withdraw
 * Crew withdraws a permanent application. Uses PERMANENT.WITHDRAWN event
 * which handles engagement closure if the applicant was selected.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (person.current_hat !== 'crew') {
    return NextResponse.json({ error: 'Only crew can withdraw applications' }, { status: 403 });
  }

  try {
    const { data: application } = await supabase
      .from('applications')
      .select('id, status')
      .eq('crew_person_id', user.id)
      .eq('permanent_posting_id', postingId)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 });
    }

    const withdrawableStatuses = ['applied', 'shortlisted', 'selected'];
    if (!withdrawableStatuses.includes(application.status)) {
      return NextResponse.json(
        { error: `Cannot withdraw a ${application.status} application` },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.WITHDRAWN',
      aggregateId: `${user.id}:${postingId}`,
      aggregateType: 'permanent',
      roleContext: 'crew',
      payload: {
        crew_person_id: user.id,
        permanent_posting_id: postingId,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to withdraw';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
