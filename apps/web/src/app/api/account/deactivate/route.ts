import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/account/deactivate
 * Appends PERSON.DEACTIVATED event. Sets deactivated_at via apply_projection.
 * Bans the auth user to prevent re-login.
 * The user's profile becomes hidden immediately (RLS filters by deactivated_at IS NULL).
 * After a retention period, PERSON.DATA_SCRUBBED will erase PII (deferred — admin process).
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  try {
    // 1. Append deactivation event (sets deactivated_at on persons row)
    await appendEvent(serviceClient, {
      eventType: 'PERSON.DEACTIVATED',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    // 2. Ban the auth user to prevent future login
    // ban_duration of 876000h (~100 years) effectively disables the account
    // while preserving the auth record for the 30-day retention period.
    // After DATA_SCRUBBED, the auth record can be fully deleted by an admin process.
    const { error: banError } = await serviceClient.auth.admin.updateUserById(user.id, {
      ban_duration: '876000h',
    });
    if (banError) {
      // Log but don't fail — deactivation event already written, profile is hidden.
      // The user won't be able to do anything meaningful even without the ban
      // because requireDomainUser checks deactivated_at.
      console.error('Failed to ban auth user after deactivation:', banError.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate account';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
