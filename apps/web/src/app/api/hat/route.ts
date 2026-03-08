import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/hat
 * Switch the user's current hat.
 * Body: { hat: 'crew' | 'employer' }
 *
 * Rules:
 * - Crew identity_type can switch between 'crew' and 'employer'
 * - Agent identity_type can only wear 'agent' (cannot switch)
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  const body = await request.json();
  const { hat } = body;

  if (!hat || !['crew', 'employer'].includes(hat)) {
    return NextResponse.json({ error: 'Invalid hat' }, { status: 400 });
  }

  // Agents cannot switch hats
  if (person.identity_type === 'agent') {
    return NextResponse.json({ error: 'Agents cannot switch hats' }, { status: 403 });
  }

  // Already wearing this hat
  if (person.current_hat === hat) {
    return NextResponse.json({ success: true, hat });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'PERSON.HAT_CHANGED',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: hat,
      payload: {
        current_hat: hat,
      },
      personId: user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to switch hat';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, hat });
}
