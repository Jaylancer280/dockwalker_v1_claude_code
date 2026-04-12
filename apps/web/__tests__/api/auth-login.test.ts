import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPassword = vi.fn();
const mockCookieSet = vi.fn();
const mockCookieGetAll = vi.fn().mockReturnValue([]);

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: mockCookieGetAll,
      set: mockCookieSet,
    }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          c: { name: string; value: string; options: Record<string, unknown> }[],
        ) => void;
      };
    },
  ) => ({
    auth: {
      signInWithPassword: async (...args: unknown[]) => {
        const result = await mockSignInWithPassword(...args);
        if (!result.error) {
          options.cookies.setAll([
            { name: 'sb-test-auth-token.0', value: 'chunk0', options: { path: '/' } },
          ]);
        }
        return result;
      },
    },
  }),
}));

import { POST } from '@/app/api/auth/login/route';

function makeFormRequest(fields: Record<string, string>) {
  const formData = new URLSearchParams(fields).toString();
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /onboarding with cookies on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'pass1234' }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass1234' });
    // Session cookies attached to redirect response
    const setCookieHeader = res.headers.getSetCookie();
    expect(setCookieHeader.some((c: string) => c.includes('sb-test-auth-token'))).toBe(true);
  });

  it('redirects to login with error on auth failure', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'wrong' }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('login_error')).toBe('Invalid credentials');
  });

  it('shows deactivation message for banned users', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'User is banned' } });
    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'pass' }));
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('login_error')).toContain('deactivated');
  });

  it('redirects with error when email is missing', async () => {
    const res = await POST(makeFormRequest({ password: 'pass1234' }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
  });
});
