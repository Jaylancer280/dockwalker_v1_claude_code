import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/account/deactivate
 * Appends PERSON.DEACTIVATED event. Sets deactivated_at via apply_projection.
 * The user's profile becomes hidden immediately (RLS filters by deactivated_at IS NULL).
 * After a retention period, PERSON.DATA_SCRUBBED will erase PII (deferred — admin process).
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  try {
    await appendEvent(serviceClient, {
      eventType: 'PERSON.DEACTIVATED',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate account';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
