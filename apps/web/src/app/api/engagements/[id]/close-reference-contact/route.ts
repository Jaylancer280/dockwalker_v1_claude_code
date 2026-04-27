import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/engagements/[id]/close-reference-contact
 *
 * Either party (referee or employer) closes a reference-contact chat.
 * Fires REFERENCE.CONTACT_THREAD_CLOSED — projection sets
 * active_engagements.status='closed', outcome='reference_complete' (B-8).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id: engagementId } = await params;

    const { data: engagement } = await serviceClient
      .from('active_engagements')
      .select('id, crew_person_id, employer_person_id, reference_contact_id, status')
      .eq('id', engagementId)
      .maybeSingle();
    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }
    if (!engagement.reference_contact_id) {
      return NextResponse.json(
        { error: 'This engagement is not a reference contact' },
        { status: 409 },
      );
    }
    if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (engagement.status !== 'active') {
      return NextResponse.json({ error: 'Conversation is already closed' }, { status: 409 });
    }

    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.CONTACT_THREAD_CLOSED',
      aggregateId: engagement.reference_contact_id as string,
      aggregateType: 'reference_contact',
      roleContext: person.current_hat,
      payload: { engagement_id: engagementId },
      personId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
