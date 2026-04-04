import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockSearchMcaDocs = vi.fn();
vi.mock('@/lib/advisor/rag', () => ({
  searchMcaDocs: (...args: unknown[]) => mockSearchMcaDocs(...args),
}));

const mockAskDocky = vi.fn();
vi.mock('@/lib/advisor/llm', () => ({
  askDocky: (...args: unknown[]) => mockAskDocky(...args),
}));

vi.mock('@/lib/advisor/crew-context', () => ({
  buildCrewContext: () => Promise.resolve({ markdown: '', certNames: [], roleName: '' }),
}));

vi.mock('@/lib/advisor/cert-analysis', () => ({
  buildCertGapContext: () => '',
}));

const mockRequireSubscription = vi.fn();
vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: (...args: unknown[]) => mockRequireSubscription(...args),
}));

import { POST } from '@/app/api/advisor/thread/messages/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [], error }).then(resolve);
  return chain;
}

function guardOk(
  fromFn: ReturnType<typeof vi.fn>,
  serviceFromFn?: ReturnType<typeof vi.fn>,
  rpcFn?: ReturnType<typeof vi.fn>,
) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: fromFn },
      serviceClient: { from: serviceFromFn ?? fromFn, rpc: rpcFn ?? vi.fn() },
    },
  };
}

function makeRequest(content: string) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

const MOCK_LLM_RESPONSE = {
  answer: 'Mock answer',
  sources: [],
  inputTokens: 100,
  outputTokens: 50,
  model: 'claude-haiku-4-5-20251001',
};

/** Helper: builds supabase mock that returns an existing active thread + empty history */
function supabaseWithThread() {
  const now = new Date().toISOString();
  const threadChain = mockChain({ id: 'thread-1', created_at: now });
  const historyChain = mockChain([]);
  return vi.fn()
    .mockReturnValueOnce(threadChain)
    .mockReturnValueOnce(historyChain);
}

/** Helper: builds service mock for insert user + insert assistant + update conv */
function serviceForFullFlow() {
  const now = new Date().toISOString();
  const insertUserChain = mockChain({ id: 'msg-1' });
  const insertAssistantChain = mockChain({
    id: 'msg-2',
    content: 'Mock answer',
    sources: [],
    created_at: now,
  });
  const updateChain = mockChain(null);
  return vi.fn()
    .mockReturnValueOnce(insertUserChain)
    .mockReturnValueOnce(insertAssistantChain)
    .mockReturnValueOnce(updateChain);
}

describe('POST /api/advisor/thread/messages — usage gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockAskDocky.mockResolvedValue(MOCK_LLM_RESPONSE);
  });

  it('free tier question 1-3 succeeds (200)', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 1 });
    const serviceFrom = serviceForFullFlow();

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(200);
  });

  it('free tier question 4 returns 402 limit_reached', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: null });
    const serviceFrom = vi.fn();

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('limit_reached');
    expect(body.used).toBe(3);
    expect(body.limit).toBe(3);
    expect(mockAskDocky).not.toHaveBeenCalled();
  });

  it('pro tier has unlimited questions', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: true, plan: 'crew_pro' });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn();
    const serviceFrom = serviceForFullFlow();

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(serviceFrom).toHaveBeenCalledTimes(3);
  });

  it('usage increments atomically via RPC on successful response', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 2 });
    const serviceFrom = serviceForFullFlow();

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Question'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith('increment_advisor_usage', {
      p_person_id: 'u1',
      p_month: expect.stringMatching(/^\d{4}-\d{2}$/),
      p_limit: 3,
    });
    expect(serviceFrom).toHaveBeenCalledTimes(3);
  });

  it('month rollover resets count (RPC inserts fresh row)', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 1 });
    const serviceFrom = serviceForFullFlow();

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('New month question'));
    expect(res.status).toBe(200);
  });
});
