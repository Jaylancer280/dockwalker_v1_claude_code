import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockRequireSubscription = vi.fn();
vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: (...args: unknown[]) => mockRequireSubscription(...args),
}));

import { GET } from '@/app/api/advisor/usage/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [], error }).then(resolve);
  return chain;
}

function guardOk(fromFn: ReturnType<typeof vi.fn>) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: fromFn },
      serviceClient: { from: fromFn },
    },
  };
}

describe('GET /api/advisor/usage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('free tier returns used and limit 10', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const usageChain = mockChain({ question_count: 2 });
    const fromFn = vi.fn().mockReturnValue(usageChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(fromFn));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.used).toBe(2);
    expect(body.limit).toBe(10);
  });

  it('pro tier returns used, limit 500, and plan', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: true, plan: 'crew_pro' });

    const usageChain = mockChain({ question_count: 42 });
    const fromFn = vi.fn().mockReturnValue(usageChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(fromFn));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.used).toBe(42);
    expect(body.limit).toBe(500);
    expect(body.plan).toBe('crew_pro');
  });

  it('employer hat returns 403', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await GET();
    expect(res.status).toBe(403);
  });
});
