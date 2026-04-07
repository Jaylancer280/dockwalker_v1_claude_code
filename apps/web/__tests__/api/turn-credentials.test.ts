import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/calls/turn-credentials/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFrom = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown): any {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return chain;
}

describe('GET /api/calls/turn-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear Twilio env vars for predictable fallback
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when no active permanent engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('permanent engagement');
  });

  it('returns STUN-only when Twilio not configured', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce(mockChain([{ id: 'eng-1' }]));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iceServers).toHaveLength(1);
    expect(body.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  it('returns STUN fallback when Twilio API fails', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'test_token';

    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce(mockChain([{ id: 'eng-1' }]));

    // Mock global fetch to simulate Twilio failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');

    globalThis.fetch = originalFetch;
  });
});
