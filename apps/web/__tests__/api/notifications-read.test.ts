import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'u1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

function makeUpdateChain() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe('POST /api/notifications/read', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('marks all notifications as read when all: true', async () => {
    const guard = guardOk();
    mockRequireDomainUser.mockResolvedValue(guard);
    const chain = makeUpdateChain();
    mockFromAuth.mockReturnValue(chain);

    const { POST } = await import('@/app/api/notifications/read/route');

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(mockFromAuth).toHaveBeenCalledWith('notifications');
    expect(chain.update).toHaveBeenCalledWith({ read: true });
  });

  it('marks specific notification IDs as read', async () => {
    const guard = guardOk();
    mockRequireDomainUser.mockResolvedValue(guard);
    const chain = makeUpdateChain();
    mockFromAuth.mockReturnValue(chain);

    const { POST } = await import('@/app/api/notifications/read/route');

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ['n1', 'n2'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(mockFromAuth).toHaveBeenCalledWith('notifications');
    expect(chain.update).toHaveBeenCalledWith({ read: true });
  });

  it('returns 400 when neither all nor notificationIds provided', async () => {
    const guard = guardOk();
    mockRequireDomainUser.mockResolvedValue(guard);

    const { POST } = await import('@/app/api/notifications/read/route');

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      }),
    });

    const { POST } = await import('@/app/api/notifications/read/route');

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
