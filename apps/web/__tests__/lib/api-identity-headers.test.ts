import { describe, it, expect } from 'vitest';
import { buildSanitizedApiHeaders } from '@/lib/auth/api-identity-headers';

/**
 * Regression coverage for audit 2026-06-01 S1 (critical auth-bypass).
 * The proxy must strip client-supplied identity headers on EVERY /api request
 * so the guard fast-paths can never trust a forged x-user-id / x-person-id.
 */
describe('buildSanitizedApiHeaders', () => {
  it('strips forged identity headers from an unauthenticated request (bypass closed)', () => {
    const incoming = new Headers({
      'x-user-id': 'attacker-supplied-victim-uuid',
      'x-person-id': 'victim-person-id',
      'x-current-hat': 'employer',
      'x-identity-type': 'crew',
      'x-blocked': 'true',
      cookie: 'sb-access-token=abc',
      'content-type': 'application/json',
    });

    const out = buildSanitizedApiHeaders(incoming, null);

    expect(out.get('x-user-id')).toBeNull();
    expect(out.get('x-person-id')).toBeNull();
    expect(out.get('x-current-hat')).toBeNull();
    expect(out.get('x-identity-type')).toBeNull();
    expect(out.get('x-blocked')).toBeNull();
    // Non-identity headers must be preserved untouched.
    expect(out.get('cookie')).toBe('sb-access-token=abc');
    expect(out.get('content-type')).toBe('application/json');
  });

  it('overrides forged headers with the verified identity when authenticated', () => {
    const incoming = new Headers({
      'x-user-id': 'forged',
      'x-person-id': 'forged',
      'x-current-hat': 'forged',
      'x-identity-type': 'forged',
    });

    const out = buildSanitizedApiHeaders(incoming, {
      userId: 'real-user-id',
      personId: 'real-person-id',
      currentHat: 'crew',
      identityType: 'crew',
    });

    expect(out.get('x-user-id')).toBe('real-user-id');
    expect(out.get('x-person-id')).toBe('real-person-id');
    expect(out.get('x-current-hat')).toBe('crew');
    expect(out.get('x-identity-type')).toBe('crew');
    expect(out.get('x-blocked')).toBeNull();
  });

  it('sets only x-user-id when person claims are absent (pre-onboarding session)', () => {
    const out = buildSanitizedApiHeaders(new Headers(), { userId: 'u1' });

    expect(out.get('x-user-id')).toBe('u1');
    expect(out.get('x-person-id')).toBeNull();
    expect(out.get('x-current-hat')).toBeNull();
    expect(out.get('x-identity-type')).toBeNull();
  });

  it('does not set person headers when the claim set is only partial', () => {
    const out = buildSanitizedApiHeaders(new Headers(), {
      userId: 'u1',
      personId: 'p1',
      // currentHat + identityType intentionally missing
    });

    expect(out.get('x-user-id')).toBe('u1');
    expect(out.get('x-person-id')).toBeNull();
    expect(out.get('x-current-hat')).toBeNull();
  });

  it('sets x-blocked only when blocked === true', () => {
    const base = {
      userId: 'u1',
      personId: 'p1',
      currentHat: 'crew',
      identityType: 'crew',
    };

    const blocked = buildSanitizedApiHeaders(new Headers(), { ...base, blocked: true });
    expect(blocked.get('x-blocked')).toBe('true');

    const notBlocked = buildSanitizedApiHeaders(new Headers(), { ...base, blocked: false });
    expect(notBlocked.get('x-blocked')).toBeNull();

    const unset = buildSanitizedApiHeaders(new Headers(), base);
    expect(unset.get('x-blocked')).toBeNull();
  });
});
