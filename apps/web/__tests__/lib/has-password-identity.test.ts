import { describe, it, expect } from 'vitest';
import { hasPasswordIdentity } from '@/lib/auth/has-password-identity';
import type { UserIdentity } from '@supabase/supabase-js';

function identity(provider: string): UserIdentity {
  return {
    id: `id-${provider}`,
    user_id: 'u1',
    identity_id: `ident-${provider}`,
    identity_data: {},
    provider,
    created_at: '',
    last_sign_in_at: '',
    updated_at: '',
  };
}

describe('hasPasswordIdentity', () => {
  it('returns true when user has an email identity', () => {
    expect(hasPasswordIdentity({ identities: [identity('email')] })).toBe(true);
  });

  it('returns false when user has only a google identity', () => {
    expect(hasPasswordIdentity({ identities: [identity('google')] })).toBe(false);
  });

  it('returns true when user has both email and google identities linked', () => {
    expect(
      hasPasswordIdentity({ identities: [identity('email'), identity('google')] }),
    ).toBe(true);
  });

  it('returns true (default-safe) when identities is null or undefined', () => {
    expect(hasPasswordIdentity(null)).toBe(true);
    expect(hasPasswordIdentity(undefined)).toBe(true);
    expect(hasPasswordIdentity({ identities: undefined })).toBe(true);
  });

  it('returns true (default-safe) when identities array is empty', () => {
    expect(hasPasswordIdentity({ identities: [] })).toBe(true);
  });
});
