import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPassword = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

// Use the real @supabase/ssr utilities (createChunks, stringToBase64URL,
// DEFAULT_COOKIE_OPTIONS) — we want to verify the route uses the exact
// format the middleware will read.

import { POST } from '@/app/api/auth/login/route';

function makeFormRequest(fields: Record<string, string>) {
  const formData = new URLSearchParams(fields).toString();
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
}

const FAKE_SESSION = {
  access_token: 'fake.access.token',
  refresh_token: 'fake-refresh-token',
  expires_at: 9999999999,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'a@b.com' },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Set required env vars
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdef.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

describe('POST /api/auth/login', () => {
  it('redirects to /onboarding (303) with session cookie on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: FAKE_SESSION }, error: null });

    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'pass1234' }));

    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass1234' });

    // Session cookie attached to redirect with the @supabase/ssr format
    const setCookieHeaders = res.headers.getSetCookie();
    const sessionCookie = setCookieHeaders.find((c: string) => c.startsWith('sb-abcdef-auth-token'));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('base64-');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie!.toLowerCase()).toContain('samesite=lax');
  });

  it('redirects to login with error message on auth failure', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'wrong' }));

    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('login_error')).toBe('Invalid login credentials');
  });

  it('shows deactivation message for banned users', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'User is banned' },
    });

    const res = await POST(makeFormRequest({ email: 'a@b.com', password: 'pass' }));
    const location = new URL(res.headers.get('location')!);
    expect(location.searchParams.get('login_error')).toContain('deactivated');
  });

  it('redirects with error when email is missing', async () => {
    const res = await POST(makeFormRequest({ password: 'pass1234' }));
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/auth/login');
  });

  it('does not call signInWithPassword when fields are missing', async () => {
    await POST(makeFormRequest({ password: 'pass1234' }));
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
