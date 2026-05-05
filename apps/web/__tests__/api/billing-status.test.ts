import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

import { GET } from '@/app/api/billing/status/route';

// B-014: route now queries `.eq('person_id').in('plan', [...])` — returns
// an array, not a single row. Mock builds a chain that resolves to an
// array of rows.
function mockFrom(returnRows: unknown[] = []) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: returnRows, error: null }),
  };
  return vi.fn().mockReturnValue(builder);
}

function guardOk(subRows: unknown[] = []) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom(subRows) },
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

  it('returns null per-tier when no subscription rows', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk([]));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptions).toEqual({ crew_pro: null, employer_pro: null });
    expect(body.current_hat).toBe('crew');
  });

  it('returns crew_pro entry when only crew_pro subscribed', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk([
        { plan: 'crew_pro', status: 'active', current_period_end: '2026-04-01T00:00:00Z' },
      ]),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptions.crew_pro).toEqual({
      status: 'active',
      current_period_end: '2026-04-01T00:00:00Z',
    });
    expect(body.subscriptions.employer_pro).toBeNull();
  });

  it('returns both entries when both Pro tiers subscribed (B-014 dual-sub)', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk([
        { plan: 'crew_pro', status: 'active', current_period_end: '2026-04-01T00:00:00Z' },
        { plan: 'employer_pro', status: 'trialing', current_period_end: '2026-04-15T00:00:00Z' },
      ]),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscriptions.crew_pro?.status).toBe('active');
    expect(body.subscriptions.employer_pro?.status).toBe('trialing');
    expect(body.subscriptions.employer_pro?.current_period_end).toBe('2026-04-15T00:00:00Z');
  });

  it('ignores rows for unknown plans (defensive against future plan additions)', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk([
        { plan: 'crew_pro', status: 'active', current_period_end: null },
        { plan: 'free', status: 'active', current_period_end: null },
      ]),
    );

    const res = await GET();
    const body = await res.json();
    expect(body.subscriptions.crew_pro?.status).toBe('active');
    expect(body.subscriptions.employer_pro).toBeNull();
    // 'free' row is in the response array (the route's `.in()` filters
    // on plan, so 'free' wouldn't actually arrive — this is just
    // defensive coverage of the per-row plan check inside the route).
  });
});
