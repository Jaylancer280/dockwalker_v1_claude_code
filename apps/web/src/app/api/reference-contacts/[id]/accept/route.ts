import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { refIdemKey } from '@/lib/references/helpers';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/reference-contacts/[id]/accept
 *
 *   - Auth required.
 *   - Validates the caller is the referee on the underlying reference, the
 *     contact is `pending`, and the underlying reference is still `accepted`
 *     (referee may have revoked between request and accept).
 *   - Fires REFERENCE.CONTACT_ACCEPTED — projection inserts an
 *     `active_engagements` row and stamps `engagement_id` on the contact.
 *   - Pre-populates the chat with the employer's question (if provided) as a
 *     system-attributed first message before responding so the referee sees
 *     the question on entry.
 *   - Returns `{ engagementId }` for redirect to `/messages/{engagementId}`.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id: contactId } = await params;

    const { data: contact } = await serviceClient
      .from('reference_contacts')
      .select('id, status, reference_id, employer_person_id, question')
      .eq('id', contactId)
      .maybeSingle();
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    if ((contact.status as string) !== 'pending') {
      return NextResponse.json({ error: 'Contact is no longer pending' }, { status: 410 });
    }

    const { data: ref } = await serviceClient
      .from('references')
      .select('id, status, referee_person_id')
      .eq('id', contact.reference_id as string)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: 'Underlying reference not found' }, { status: 404 });
    }
    if ((ref.referee_person_id as string | null) !== user.id) {
      return NextResponse.json(
        { error: 'Only the referee can accept this contact request' },
        { status: 403 },
      );
    }
    if ((ref.status as string) !== 'accepted') {
      return NextResponse.json(
        { error: 'Underlying reference is no longer accepted' },
        { status: 409 },
      );
    }

    const engagementId = randomUUID();
    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.CONTACT_ACCEPTED',
      aggregateId: contactId,
      aggregateType: 'reference_contact',
      roleContext: person.current_hat,
      payload: { engagement_id: engagementId },
      personId: user.id,
      idempotencyKey: refIdemKey.contactAccept(contactId),
    });

    // Pre-populate the chat with the employer's question (if provided) so the
    // referee sees it as the first message on entry. Fired as a MESSAGE.SENT
    // event under the EMPLOYER's identity so the bubble looks like theirs.
    if (contact.question && (contact.question as string).trim().length > 0) {
      await appendEvent(serviceClient, {
        eventType: 'MESSAGE.SENT',
        aggregateId: engagementId,
        aggregateType: 'message',
        roleContext: 'employer',
        payload: {
          id: randomUUID(),
          engagement_id: engagementId,
          content: contact.question as string,
          is_system: false,
        },
        personId: contact.employer_person_id as string,
      });
    }

    notifyOnEvent(
      serviceClient,
      'REFERENCE.CONTACT_ACCEPTED',
      {
        contact_id: contactId,
        engagement_id: engagementId,
        recipient_person_id: contact.employer_person_id as string,
      },
      user.id,
    );

    return NextResponse.json({ engagementId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
