import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

import { GET } from '@/app/api/advisor/thread/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
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

function guardOk(fromFn: ReturnType<typeof vi.fn>, serviceFromFn?: ReturnType<typeof vi.fn>) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: fromFn },
      serviceClient: { from: serviceFromFn ?? fromFn },
    },
  };
}

function guardUnauth() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  };
}

describe('GET /api/advisor/thread', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns active thread + messages (200)', async () => {
    const now = new Date().toISOString();
    const threadData = { id: 'thread-1', created_at: now };
    const msgs = [
      { id: 'msg-1', role: 'user', content: 'Hello', sources: null, created_at: now },
      { id: 'msg-2', role: 'assistant', content: 'Hi', sources: [], created_at: now },
    ];

    // First call: thread lookup; second call: messages fetch
    const threadChain = mockChain(threadData);
    const msgsChain = mockChain(msgs);
    msgsChain.order = vi.fn().mockReturnValue({
      ...msgsChain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: msgs, error: null }).then(resolve),
    });

    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(threadChain) // advisor_conversations
      .mockReturnValueOnce(msgsChain); // advisor_messages

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread).toEqual({ id: 'thread-1', created_at: now });
    expect(body.messages).toHaveLength(2);
  });

  it('auto-erases expired thread (>72h), returns empty (200)', async () => {
    const oldDate = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
    const threadData = { id: 'thread-old', created_at: oldDate };

    const threadChain = mockChain(threadData);
    const supabaseFrom = vi.fn().mockReturnValue(threadChain);

    // Service client deletes the expired thread
    const deleteChain = mockChain(null);
    const serviceFrom = vi.fn().mockReturnValue(deleteChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread).toBeNull();
    expect(body.messages).toEqual([]);
    // Verify delete was called
    expect(serviceFrom).toHaveBeenCalledTimes(1);
  });

  it('returns empty when no thread exists (200)', async () => {
    // .single() returns PGRST116 error when no rows match
    const threadChain = mockChain(null, { code: 'PGRST116' });
    const supabaseFrom = vi.fn().mockReturnValue(threadChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it('returns 401 unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardUnauth());
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 employer hat', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await GET();
    expect(res.status).toBe(403);
  });
});
