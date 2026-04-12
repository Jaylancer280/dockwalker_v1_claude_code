import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchangeCodeForSession = vi.fn();
const mockVerifyOtp = vi.fn();
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
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: Function } }) => {
    // Simulate Supabase calling setAll when session is established
    return {
      auth: {
        exchangeCodeForSession: async (...args: unknown[]) => {
          const result = await mockExchangeCodeForSession(...args);
          if (!result.error) {
            // Simulate Supabase setting cookies on success
            options.cookies.setAll([
              { name: 'sb-test-auth-token.0', value: 'chunk0', options: { path: '/' } },
            ]);
          }
          return result;
        },
        verifyOtp: async (...args: unknown[]) => {
          const result = await mockVerifyOtp(...args);
          if (!result.error) {
            options.cookies.setAll([
              { name: 'sb-test-auth-token.0', value: 'chunk0', options: { path: '/' } },
            ]);
          }
          return result;
        },
      },
    };
  },
}));

import { GET } from '@/app/auth/callback/route';

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/auth/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGetAll.mockReturnValue([]);
  });

  it('exchanges PKCE code and redirects to next', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(makeRequest({ code: 'abc123', next: '/auth/reset-password' }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/reset-password');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });

  it('attaches session cookies to the redirect response', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(makeRequest({ code: 'abc123', next: '/auth/reset-password' }));
    // Verify cookies are set directly on the redirect response
    const setCookieHeader = res.headers.getSetCookie();
    expect(setCookieHeader.some((c: string) => c.includes('sb-test-auth-token'))).toBe(true);
  });

  it('falls back to token_hash + type when no code', async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      makeRequest({ token_hash: 'hash123', type: 'recovery', next: '/auth/reset-password' }),
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/reset-password');
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'recovery' });
  });

  it('tries token_hash when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid' } });
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      makeRequest({
        code: 'bad',
        token_hash: 'hash123',
        type: 'recovery',
        next: '/auth/reset-password',
      }),
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/reset-password');
  });

  it('redirects to login with error when both flows fail', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'fail' } });
    const res = await GET(makeRequest({ code: 'bad' }));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('error')).toBe('auth_failed');
  });

  it('defaults next to /onboarding', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(makeRequest({ code: 'abc' }));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding');
  });
});
