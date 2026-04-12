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

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and sets cookies on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass1234' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass1234' });
    // Session cookies attached to response
    const setCookieHeader = res.headers.getSetCookie();
    expect(setCookieHeader.some((c: string) => c.includes('sb-test-auth-token'))).toBe(true);
  });

  it('returns 401 with error message on auth failure', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'wrong' }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'pass1234' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
