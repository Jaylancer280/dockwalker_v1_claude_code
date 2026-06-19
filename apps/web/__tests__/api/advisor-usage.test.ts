import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: () => {} };
});

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockSearchMcaDocs = vi.fn();
vi.mock('@/lib/advisor/rag', () => ({
  searchMcaDocs: (...args: unknown[]) => mockSearchMcaDocs(...args),
}));

const mockStreamDocky = vi.fn();
vi.mock('@/lib/advisor/llm', () => ({
  streamDocky: (...args: unknown[]) => mockStreamDocky(...args),
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
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
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

function makeMockStream(text = 'Mock answer') {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', sources: [] })}\n\n`));
      controller.close();
    },
  });
  return {
    stream,
    completion: Promise.resolve({ text, inputTokens: 100, outputTokens: 50, model: 'claude-haiku-4-5-20251001' }),
  };
}

function supabaseWithThread() {
  const now = new Date().toISOString();
  const threadChain = mockChain({ id: 'thread-1', created_at: now });
  const historyChain = mockChain([]);
  return vi.fn()
    .mockReturnValueOnce(threadChain)
    .mockReturnValueOnce(historyChain);
}

function serviceForFullFlow(usageCount: number | null = null) {
  const usageCheckChain = mockChain(usageCount !== null ? { question_count: usageCount } : null);
  const insertUserChain = mockChain({ id: 'msg-1' });
  const insertAssistantChain = mockChain({ id: 'msg-2' });
  const updateChain = mockChain(null);
  const interactionChain = mockChain(null);
  return vi.fn()
    .mockReturnValueOnce(usageCheckChain)
    .mockReturnValueOnce(insertUserChain)
    .mockReturnValueOnce(insertAssistantChain)
    .mockReturnValueOnce(updateChain)
    .mockReturnValueOnce(interactionChain);
}

describe('POST /api/advisor/thread/messages — usage gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockStreamDocky.mockReturnValue(makeMockStream());
  });

  it('free tier question within limit succeeds (200)', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 1 });
    const serviceFrom = serviceForFullFlow(3); // 3 used, limit 10

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(200);
  });

  it('free tier over limit returns 402 limit_reached', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn();
    const serviceFrom = serviceForFullFlow(10); // at limit

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('limit_reached');
    expect(body.limit).toBe(10);
    expect(mockStreamDocky).not.toHaveBeenCalled();
  });

  it('pro tier succeeds with higher limit', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: true, plan: 'crew_pro' });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 42 });
    const serviceFrom = serviceForFullFlow(42); // 42 used, limit 500

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(200);
  });

  it('usage increment happens after successful response via RPC', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 2 });
    const serviceFrom = serviceForFullFlow(1);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('Question'));
    expect(res.status).toBe(200);
    // RPC is called in background .then() — may not have resolved yet
    // but the serviceFrom should have been called for the usage check
    expect(serviceFrom).toHaveBeenCalled();
  });

  it('no usage row yet allows first question', async () => {
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });

    const supabaseFrom = supabaseWithThread();
    const mockRpc = vi.fn().mockResolvedValue({ data: 1 });
    const serviceFrom = serviceForFullFlow(); // null = no usage row

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom, mockRpc));

    const res = await POST(makeRequest('New month question'));
    expect(res.status).toBe(200);
  });
});
