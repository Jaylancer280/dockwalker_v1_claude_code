import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers — default: no middleware headers (direct API call path)
const mockHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({
    get: (key: string) => mockHeaders.get(key) ?? null,
  }),
}));

// Mock Supabase server module
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
  createServiceClient: () => Promise.resolve({ rpc: vi.fn() }),
}));

const { requireDomainUser } = await import('@/lib/auth/require-domain-user');

function chainBuilder(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

describe('requireDomainUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.clear();
  });

  it('returns 401 when no auth user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await requireDomainUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 409 when person row not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValue(chainBuilder(null));
    const result = await requireDomainUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
    }
  });

  it('returns 403 when person is deactivated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValueOnce(
      chainBuilder({
        id: 'u1',
        identity_type: 'crew',
        current_hat: 'crew',
        is_admin: false,
        deactivated_at: '2026-03-20T00:00:00Z',
      }),
    );
    const result = await requireDomainUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe('Account deactivated');
    }
  });

  it('returns ok when person is active with profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    // First call: persons table
    mockFrom.mockReturnValueOnce(
      chainBuilder({
        id: 'u1',
        identity_type: 'crew',
        current_hat: 'crew',
        is_admin: false,
        deactivated_at: null,
      }),
    );
    // Second call: profiles table
    mockFrom.mockReturnValueOnce(chainBuilder({ person_id: 'u1' }));

    const result = await requireDomainUser();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.person.id).toBe('u1');
      expect(result.value.person.current_hat).toBe('crew');
    }
  });

  // --- JWT custom claims fast path ---

  it('returns ok using JWT claims without DB queries', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          app_metadata: {
            person_id: 'u1',
            current_hat: 'employer',
            identity_type: 'crew',
            onboarded: true,
          },
        },
      },
    });

    const result = await requireDomainUser();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.person.id).toBe('u1');
      expect(result.value.person.current_hat).toBe('employer');
      expect(result.value.person.identity_type).toBe('crew');
      expect(result.value.person.is_admin).toBe(false);
    }
    // No DB queries should have been made (mockFrom not called)
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 403 via claims when user is deactivated', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          app_metadata: {
            person_id: 'u1',
            current_hat: 'crew',
            identity_type: 'crew',
            onboarded: true,
            deactivated: true,
          },
        },
      },
    });

    const result = await requireDomainUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 409 via claims when not onboarded', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          app_metadata: {
            person_id: 'u1',
            current_hat: 'crew',
            identity_type: 'crew',
            onboarded: false,
          },
        },
      },
    });

    const result = await requireDomainUser();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
    }
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to DB queries when claims are incomplete', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          app_metadata: { person_id: 'u1' }, // missing current_hat, identity_type
        },
      },
    });
    // Fallback DB queries
    mockFrom.mockReturnValueOnce(
      chainBuilder({
        id: 'u1',
        identity_type: 'crew',
        current_hat: 'crew',
        is_admin: false,
        deactivated_at: null,
      }),
    );
    mockFrom.mockReturnValueOnce(chainBuilder({ person_id: 'u1' }));

    const result = await requireDomainUser();
    expect(result.ok).toBe(true);
    // DB fallback was used
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  // --- Middleware header fast path ---

  it('returns ok from middleware headers without calling getUser()', async () => {
    mockHeaders.set('x-user-id', 'u1');
    mockHeaders.set('x-person-id', 'p1');
    mockHeaders.set('x-current-hat', 'employer');
    mockHeaders.set('x-identity-type', 'crew');

    const result = await requireDomainUser();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.user.id).toBe('u1');
      expect(result.value.person.id).toBe('p1');
      expect(result.value.person.current_hat).toBe('employer');
      expect(result.value.person.identity_type).toBe('crew');
    }
    // getUser() should NOT have been called
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to getUser() when middleware headers are partial', async () => {
    mockHeaders.set('x-user-id', 'u1');
    // Missing x-person-id — incomplete headers, fall back

    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFrom.mockReturnValueOnce(
      chainBuilder({
        id: 'u1',
        identity_type: 'crew',
        current_hat: 'crew',
        is_admin: false,
        deactivated_at: null,
      }),
    );
    mockFrom.mockReturnValueOnce(chainBuilder({ person_id: 'u1' }));

    const result = await requireDomainUser();
    expect(result.ok).toBe(true);
    // getUser() WAS called (fallback path)
    expect(mockGetUser).toHaveBeenCalled();
  });
});
