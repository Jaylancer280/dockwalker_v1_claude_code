import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockStripe = {
  billingPortal: { sessions: { create: vi.fn() } },
};
vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockStripe,
}));

import { POST } from '@/app/api/billing/create-portal/route';

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

describe('POST /api/billing/create-portal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const res = await POST(new Request('http://localhost', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when no subscription row', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk(null));

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    }));
    expect(res.status).toBe(404);
  });

  it('returns 200 with portal URL', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk({ stripe_customer_id: 'cus_123' }));
    mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/portal');
  });
});
