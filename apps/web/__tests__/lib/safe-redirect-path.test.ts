import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '@/lib/auth/safe-redirect-path';

describe('safeRedirectPath', () => {
  it('accepts valid in-app paths', () => {
    expect(safeRedirectPath('/cv/AbCd1234')).toBe('/cv/AbCd1234');
    expect(safeRedirectPath('/profile')).toBe('/profile');
    expect(safeRedirectPath('/discover?tab=invitations')).toBe('/discover?tab=invitations');
    expect(safeRedirectPath('/permanent/abc-123/apply?from_invitation=inv-1')).toBe(
      '/permanent/abc-123/apply?from_invitation=inv-1',
    );
  });

  it('returns null for missing input', () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath('')).toBeNull();
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(safeRedirectPath('//evil.com')).toBeNull();
    expect(safeRedirectPath('//evil.com/cv/AbCd1234')).toBeNull();
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com/cv')).toBeNull();
    expect(safeRedirectPath('http://evil.com')).toBeNull();
  });

  it('rejects protocol injection (javascript:, data:, mailto:)', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(safeRedirectPath('data:text/html,foo')).toBeNull();
    expect(safeRedirectPath('mailto:foo@bar.com')).toBeNull();
    // Even when the prefix is `/`, the colon still triggers — defence-
    // in-depth against weird parser edge-cases.
    expect(safeRedirectPath('/foo:bar')).toBeNull();
  });

  it('rejects path traversal', () => {
    expect(safeRedirectPath('/foo/../etc/passwd')).toBeNull();
    expect(safeRedirectPath('/..')).toBeNull();
  });

  it('rejects paths that do not start with /', () => {
    expect(safeRedirectPath('cv/AbCd1234')).toBeNull();
    expect(safeRedirectPath('profile')).toBeNull();
  });

  it('rejects pathological lengths (URL-bomb DoS)', () => {
    expect(safeRedirectPath('/' + 'a'.repeat(300))).toBeNull();
  });

  it('rejects non-string inputs (defence)', () => {
    // Realistic shape: searchParams.get() returns string | null. Tests
    // shape resilience against mis-typed callers.
    expect(safeRedirectPath(undefined as unknown as string)).toBeNull();
  });
});
