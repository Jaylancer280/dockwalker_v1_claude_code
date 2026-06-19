import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/reference-contacts/[id]/decline
 *
 *   - Auth required, must be the referee on the underlying reference.
 *   - Fires REFERENCE.CONTACT_DECLINED. No notification — silent decline.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    const { id: contactId } = await params;

    const { data: contact } = await serviceClient
      .from('reference_contacts')
      .select('id, status, reference_id')
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
      .select('referee_person_id')
      .eq('id', contact.reference_id as string)
      .maybeSingle();
    if (!ref || (ref.referee_person_id as string | null) !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.CONTACT_DECLINED',
      aggregateId: contactId,
      aggregateType: 'reference_contact',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
