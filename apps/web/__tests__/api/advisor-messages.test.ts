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

const mockBuildCrewContext = vi.fn();
vi.mock('@/lib/advisor/crew-context', () => ({
  buildCrewContext: (...args: unknown[]) => mockBuildCrewContext(...args),
}));

vi.mock('@/lib/advisor/cert-analysis', () => ({
  buildCertGapContext: () => '',
}));

vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: () => Promise.resolve({ ok: true, plan: 'crew_pro' }),
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

function guardOk(fromFn: ReturnType<typeof vi.fn>, serviceFromFn?: ReturnType<typeof vi.fn>) {
  return {
    ok: true as const,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: fromFn },
      serviceClient: { from: serviceFromFn ?? fromFn, rpc: vi.fn() },
    },
  };
}

function guardUnauth() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
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
  answer: 'Mock answer from Docky',
  sources: [
    { document: 'MIN 599', section: 'Section 1', url: 'https://example.com', relevance: 0.85 },
  ],
  inputTokens: 100,
  outputTokens: 50,
  model: 'claude-haiku-4-5-20251001',
};

describe('POST /api/advisor/thread/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockAskDocky.mockResolvedValue(MOCK_LLM_RESPONSE);
    mockBuildCrewContext.mockResolvedValue({ markdown: '', certNames: [], roleName: '' });
  });

  it('returns 200 with assistant message on happy path (existing thread)', async () => {
    const now = new Date().toISOString();
    // Supabase: find existing thread, then fetch history
    const threadChain = mockChain({ id: 'thread-1', created_at: now });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(threadChain) // find thread
      .mockReturnValueOnce(historyChain); // history

    // Service client: insert user msg, insert assistant msg, update conv
    const insertUserChain = mockChain({ id: 'msg-1' });
    const insertAssistantChain = mockChain({
      id: 'msg-2',
      content: 'Mock answer from Docky',
      sources: MOCK_LLM_RESPONSE.sources,
      created_at: now,
    });
    const updateChain = mockChain(null);
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(insertUserChain) // insert user msg
      .mockReturnValueOnce(insertAssistantChain) // insert assistant msg
      .mockReturnValueOnce(updateChain); // update conv

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('What certs do I need?'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('assistant');
    expect(body.content).toBe('Mock answer from Docky');
    expect(mockAskDocky).toHaveBeenCalledOnce();
  });

  it('auto-creates thread if none exists', async () => {
    // Supabase: no existing thread, then fetch history
    const noThreadChain = mockChain(null, { code: 'PGRST116' });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(noThreadChain) // no thread found
      .mockReturnValueOnce(historyChain); // history (empty for new thread)

    const now = new Date().toISOString();
    // Service client: create thread, insert user msg, insert assistant msg, update conv
    const createThreadChain = mockChain({ id: 'new-thread' });
    const insertUserChain = mockChain({ id: 'msg-1' });
    const insertAssistantChain = mockChain({
      id: 'msg-2',
      content: 'Mock answer from Docky',
      sources: MOCK_LLM_RESPONSE.sources,
      created_at: now,
    });
    const updateChain = mockChain(null);
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(createThreadChain) // create thread
      .mockReturnValueOnce(insertUserChain) // insert user msg
      .mockReturnValueOnce(insertAssistantChain) // insert assistant msg
      .mockReturnValueOnce(updateChain); // update conv

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(200);
  });

  it('returns 400 for empty content', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk(vi.fn()));

    const res = await POST(makeRequest(''));
    expect(res.status).toBe(400);
  });

  it('returns 400 for content over 500 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk(vi.fn()));

    const res = await POST(makeRequest('a'.repeat(501)));
    expect(res.status).toBe(400);
  });

  it('returns 403 when employer hat', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardUnauth());
    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(401);
  });

  it('returns 503 when LLM throws and user message is still saved', async () => {
    mockAskDocky.mockRejectedValue(new Error('API down'));

    const now = new Date().toISOString();
    const threadChain = mockChain({ id: 'thread-1', created_at: now });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(threadChain)
      .mockReturnValueOnce(historyChain);

    const insertUserChain = mockChain({ id: 'msg-1' });
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(insertUserChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(503);
    // User message was saved (serviceFrom called for insert)
    expect(serviceFrom).toHaveBeenCalledTimes(1);
  });
});
