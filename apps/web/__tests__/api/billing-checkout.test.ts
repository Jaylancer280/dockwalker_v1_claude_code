import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockStripe = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
};
vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockStripe,
}));

import { POST } from '@/app/api/billing/create-checkout/route';

// B-014: existing-customer lookup is now `.eq('person_id').limit(1)`
// returning an array (multi-row safe). Builder resolves to `{ data: [] }`
// or `{ data: [{ stripe_customer_id: '...' }] }`.
function mockFrom(returnRows: unknown[] = []) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: returnRows, error: null }),
  };
  return vi.fn().mockReturnValue(builder);
}

function guardOk(subRows: unknown[] = []) {
  const fromMock = mockFrom(subRows);
  const serviceFrom = vi.fn().mockReturnValue({
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: fromMock },
      serviceClient: { from: serviceFrom },
    },
  };
}

describe('POST /api/billing/create-checkout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ plan: 'crew_pro' }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid plan', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_123');

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ plan: 'invalid' }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('plan must be');
  });

  it('returns 201 — new customer (creates customer + session)', async () => {
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_123');
    mockRequireDomainUser.mockResolvedValue(guardOk([]));
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ plan: 'crew_pro' }),
      headers: { origin: 'http://localhost:3000' },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/session');
    expect(mockStripe.customers.create).toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_new', mode: 'subscription' }),
    );
  });

  it('returns 201 — existing customer (skips customer creation)', async () => {
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_123');
    mockRequireDomainUser.mockResolvedValue(guardOk([{ stripe_customer_id: 'cus_existing' }]));
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ plan: 'crew_pro' }),
      headers: { origin: 'http://localhost:3000' },
    }));
    expect(res.status).toBe(201);
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
    );
  });

  it('B-014 dual-sub: existing pro subscriber initiating second tier reuses customer_id', async () => {
    // Person already has 'free' + 'crew_pro' rows (multi-row state).
    // Their second checkout for employer_pro must look up the existing
    // customer_id from any of those rows and skip creating a new
    // Stripe customer.
    vi.stubEnv('STRIPE_PRICE_EMPLOYER_PRO', 'price_emp');
    mockRequireDomainUser.mockResolvedValue(
      guardOk([{ stripe_customer_id: 'cus_dual' }]),
    );
    mockStripe.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.stripe.com/dual-sub',
    });

    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ plan: 'employer_pro' }),
    }));
    expect(res.status).toBe(201);
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_dual' }),
    );
  });
});
