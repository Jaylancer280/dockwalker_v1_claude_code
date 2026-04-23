import type { User, UserIdentity } from '@supabase/supabase-js';

/**
 * Returns true if the auth user has an email+password identity.
 *
 * Used to gate password-related UI (change-password form). Users who signed
 * up exclusively via OAuth (e.g. Google) have no password — showing them a
 * "current password" field is confusing and the update would fail.
 *
 * A user with BOTH google and email identities (linked) returns true.
 */
export function hasPasswordIdentity(user: Pick<User, 'identities'> | null | undefined): boolean {
  if (!user?.identities || user.identities.length === 0) {
    // No identities array — fall back to true so we don't accidentally hide
    // the password form for legacy users whose identities aren't populated.
    return true;
  }
  return user.identities.some((i: UserIdentity) => i.provider === 'email');
}
