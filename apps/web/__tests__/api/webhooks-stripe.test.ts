import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStripe = {
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
};
vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockStripe,
}));

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
const mockSelectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockServiceClient = {
  from: vi.fn().mockReturnValue({
    upsert: mockUpsert,
    update: mockUpdate,
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: mockSelectSingle,
      }),
    }),
  }),
};
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => Promise.resolve(mockServiceClient),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function makeRequest(body: string, signature = 'sig_valid') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': signature },
  });
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  });

  it('returns 400 on invalid signature', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await POST(makeRequest('{}', 'bad_sig'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  it('handles checkout.session.completed — upserts subscription', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          metadata: { person_id: 'u1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
      items: {
        data: [{
          price: { id: 'price_pro' },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        }],
      },
    });
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_pro');

    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockServiceClient.from).toHaveBeenCalledWith('subscriptions');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 'u1',
        stripe_customer_id: 'cus_123',
        plan: 'crew_pro',
        status: 'active',
      }),
      { onConflict: 'person_id' },
    );
  });

  it('handles customer.subscription.updated — updates row', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          status: 'past_due',
          items: {
            data: [{
              price: { id: 'price_pro' },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            }],
          },
        },
      },
    });
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_pro');

    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'crew_pro', status: 'past_due' }),
    );
  });

  it('handles checkout.session.completed — falls back to DB lookup when session metadata missing', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          metadata: {},
        },
      },
    });
    mockSelectSingle.mockResolvedValue({ data: { person_id: 'u1' }, error: null });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
      items: {
        data: [{
          price: { id: 'price_pro' },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        }],
      },
    });
    vi.stubEnv('STRIPE_PRICE_CREW_PRO', 'price_pro');

    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ person_id: 'u1' }),
      { onConflict: 'person_id' },
    );
  });

  it('handles customer.subscription.deleted — marks cancelled', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_456' },
      },
    });

    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
    );
  });
});
