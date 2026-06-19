import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockServicePersonsSelect = vi.fn();
const mockAppendEvent = vi.fn();
const mockAdminUpdateUser = vi.fn();
const mockCookieGetAll = vi.fn().mockReturnValue([]);

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ getAll: mockCookieGetAll }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(mockServicePersonsSelect()),
        }),
      }),
    }),
    auth: {
      admin: {
        updateUserById: mockAdminUpdateUser,
      },
    },
  }),
}));

vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

import { POST } from '@/app/api/auth/reactivate/route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdef.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  mockAdminUpdateUser.mockResolvedValue({ error: null });
  mockAppendEvent.mockResolvedValue('event-id-1');
});

describe('POST /api/auth/reactivate', () => {
  it('returns 401 when no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns reactivated:false when persons row not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockServicePersonsSelect.mockReturnValue({ data: null, error: { message: 'not found' } });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactivated).toBe(false);
    expect(mockAppendEvent).not.toHaveBeenCalled();
    expect(mockAdminUpdateUser).not.toHaveBeenCalled();
  });

  it('returns reactivated:false when account is already active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockServicePersonsSelect.mockReturnValue({
      data: { id: 'user-1', current_hat: 'crew', deactivated_at: null },
      error: null,
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactivated).toBe(false);
    expect(mockAppendEvent).not.toHaveBeenCalled();
    expect(mockAdminUpdateUser).not.toHaveBeenCalled();
  });

  it('appends PERSON.REACTIVATED + unbans when deactivated_at is set', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockServicePersonsSelect.mockReturnValue({
      data: { id: 'user-1', current_hat: 'crew', deactivated_at: '2026-04-01T00:00:00Z' },
      error: null,
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactivated).toBe(true);

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PERSON.REACTIVATED',
        aggregateType: 'person',
        aggregateId: 'user-1',
        personId: 'user-1',
        roleContext: 'crew',
      }),
    );

    expect(mockAdminUpdateUser).toHaveBeenCalledWith('user-1', { ban_duration: 'none' });
  });

  it('returns 500 when unban fails after event was written', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockServicePersonsSelect.mockReturnValue({
      data: { id: 'user-1', current_hat: 'crew', deactivated_at: '2026-04-01T00:00:00Z' },
      error: null,
    });
    mockAdminUpdateUser.mockResolvedValue({ error: { message: 'admin api failed' } });

    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Contact support');
  });

  it('returns 500 when appendEvent throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockServicePersonsSelect.mockReturnValue({
      data: { id: 'user-1', current_hat: 'crew', deactivated_at: '2026-04-01T00:00:00Z' },
      error: null,
    });
    mockAppendEvent.mockRejectedValue(new Error('append_event RPC failed'));

    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('append_event RPC failed');
  });
});
