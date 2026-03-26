import { describe, it, expect, vi, beforeEach } from 'vitest';

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
});
