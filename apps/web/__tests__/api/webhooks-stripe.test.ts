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
// B-014: customer-id fallback lookup is now `.eq('stripe_customer_id').limit(1).maybeSingle()`
// (was `.single()`). Multi-row safe — the same customer can anchor up
// to 3 rows per person.
const mockSelectMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockServiceClient = {
  from: vi.fn().mockReturnValue({
    upsert: mockUpsert,
    update: mockUpdate,
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: mockSelectMaybeSingle,
        }),
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

  it('handles checkout.session.completed — upserts subscription with (person_id, plan) conflict key', async () => {
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
      { onConflict: 'person_id,plan' },
    );
  });

  it('B-014 dual-sub: second checkout for a different plan inserts a new row, not overwrite', async () => {
    // The (person_id, plan) conflict key is what makes this work — a
    // person who already has crew_pro can complete a checkout for
    // employer_pro and the upsert lands on a NEW row instead of
    // overwriting the crew_pro row's plan field.
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_dual',
          subscription: 'sub_emp',
          metadata: { person_id: 'u1' },
        },
      },
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
      items: {
        data: [{
          price: { id: 'price_emp' },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        }],
      },
    });
    vi.stubEnv('STRIPE_PRICE_EMPLOYER_PRO', 'price_emp');

    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 'u1',
        plan: 'employer_pro',
      }),
      { onConflict: 'person_id,plan' },
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
    mockSelectMaybeSingle.mockResolvedValue({ data: { person_id: 'u1' }, error: null });
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
      { onConflict: 'person_id,plan' },
    );
  });

  it('handles customer.subscription.deleted — marks cancelled (per stripe_subscription_id, other plans untouched)', async () => {
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
    // B-014 sanity: deletion targets stripe_subscription_id (not person_id),
    // so a crew_pro cancellation never touches the person's employer_pro
    // row. Verify the .eq() filter was on stripe_subscription_id.
    expect(mockUpdateEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_456');
  });
});
