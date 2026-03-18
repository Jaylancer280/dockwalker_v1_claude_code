import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

import { POST, GET } from '@/app/api/advisor/conversations/route';
import { DELETE } from '@/app/api/advisor/conversations/[id]/route';

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

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/advisor/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with conversation id', async () => {
    const serviceChain = mockChain({ id: 'conv-1' });
    const serviceFrom = vi.fn().mockReturnValue(serviceChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(vi.fn(), serviceFrom));

    const res = await POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('conv-1');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardUnauth());
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 403 when employer hat', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await POST();
    expect(res.status).toBe(403);
  });
});

describe('GET /api/advisor/conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with conversations', async () => {
    const data = [
      {
        id: 'conv-1',
        title: 'Test',
        updated_at: '2026-03-17T00:00:00Z',
        advisor_messages: [{ content: 'Hello there' }],
      },
    ];
    const chain = mockChain(data);
    // Override .then for list queries that await the chain directly
    chain.limit.mockImplementation(() => ({
      ...chain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data, error: null }).then(resolve),
    }));
    const fromFn = vi.fn().mockReturnValue(chain);
    mockRequireDomainUser.mockResolvedValue(guardOk(fromFn));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].preview).toBe('Hello there');
  });
});

describe('DELETE /api/advisor/conversations/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 204 on success', async () => {
    const chain = mockChain(null);
    chain.select.mockImplementation(() => ({
      ...chain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [{ id: 'conv-1' }], error: null }).then(resolve),
    }));
    const fromFn = vi.fn().mockReturnValue(chain);
    mockRequireDomainUser.mockResolvedValue(guardOk(fromFn));

    const res = await DELETE(new Request('http://localhost'), makeParams('conv-1'));
    expect(res.status).toBe(204);
  });

  it('returns 404 when conversation not found', async () => {
    const chain = mockChain(null);
    chain.select.mockImplementation(() => ({
      ...chain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }));
    const fromFn = vi.fn().mockReturnValue(chain);
    mockRequireDomainUser.mockResolvedValue(guardOk(fromFn));

    const res = await DELETE(new Request('http://localhost'), makeParams('conv-999'));
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardUnauth());
    const res = await DELETE(new Request('http://localhost'), makeParams('conv-1'));
    expect(res.status).toBe(401);
  });
});
