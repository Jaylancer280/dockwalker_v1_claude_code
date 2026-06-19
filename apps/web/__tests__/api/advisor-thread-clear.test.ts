import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

import { POST } from '@/app/api/advisor/thread/clear/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error }).then(resolve);
  return chain;
}

function guardOk(serviceFromFn: ReturnType<typeof vi.fn>) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: serviceFromFn },
    },
  };
}

describe('POST /api/advisor/thread/clear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes thread and returns 204', async () => {
    // First call: find thread; second call: delete
    const findChain = mockChain({ id: 'thread-1' });
    const deleteChain = mockChain(null);
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(findChain)
      .mockReturnValueOnce(deleteChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(serviceFrom));

    const res = await POST();
    expect(res.status).toBe(204);
    expect(serviceFrom).toHaveBeenCalledTimes(2);
  });

  it('returns 204 even when no thread exists (idempotent)', async () => {
    const findChain = mockChain(null, { code: 'PGRST116' });
    const serviceFrom = vi.fn().mockReturnValue(findChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(serviceFrom));

    const res = await POST();
    expect(res.status).toBe(204);
    // Only the find call, no delete
    expect(serviceFrom).toHaveBeenCalledTimes(1);
  });
});
