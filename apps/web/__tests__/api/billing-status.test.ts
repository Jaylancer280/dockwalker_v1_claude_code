import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

import { GET } from '@/app/api/billing/status/route';

function mockFrom(returnData: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
  };
  return vi.fn().mockReturnValue(builder);
}

function guardOk(subData: unknown = null) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom(subData) },
      serviceClient: { from: vi.fn() },
    },
  };
}

describe('GET /api/billing/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns { plan: free } when no subscription row', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk(null));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe('free');
    expect(body.status).toBeNull();
  });

  it('returns plan + status when subscribed', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ plan: 'crew_pro', status: 'active', current_period_end: '2026-04-01T00:00:00Z' }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe('crew_pro');
    expect(body.status).toBe('active');
    expect(body.current_period_end).toBe('2026-04-01T00:00:00Z');
  });
});
