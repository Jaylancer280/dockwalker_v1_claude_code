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

import {
  POST,
  GET,
} from '@/app/api/advisor/conversations/[id]/messages/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [], error }).then(resolve);
  return chain;
}

/** Build a from() that returns different chains for different tables */
function multiTableFrom(tableMap: Record<string, ReturnType<typeof mockChain>>) {
  return vi.fn().mockImplementation((table: string) => tableMap[table] ?? mockChain(null));
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

describe('POST /api/advisor/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockAskDocky.mockResolvedValue(MOCK_LLM_RESPONSE);
    mockBuildCrewContext.mockResolvedValue({ markdown: '', certNames: [], roleName: '' });
  });

  it('returns 200 with assistant message on happy path', async () => {
    // Supabase: ownership check
    const convChain = mockChain({ id: 'conv-1', person_id: 'u1' });
    // Supabase: history fetch
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(convChain) // advisor_conversations ownership
      .mockReturnValueOnce(historyChain); // advisor_messages history

    // Service client: insert user msg, insert assistant msg, update conversation
    const insertUserChain = mockChain({ id: 'msg-1' });
    const insertAssistantChain = mockChain({
      id: 'msg-2',
      content: 'Mock answer from Docky',
      sources: MOCK_LLM_RESPONSE.sources,
      created_at: '2026-03-17T00:00:00Z',
    });
    const updateChain = mockChain(null);
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(insertUserChain) // advisor_messages insert (user)
      .mockReturnValueOnce(insertAssistantChain) // advisor_messages insert (assistant)
      .mockReturnValueOnce(updateChain); // advisor_conversations update

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('What certs do I need?'), makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('assistant');
    expect(body.content).toBe('Mock answer from Docky');
    expect(mockAskDocky).toHaveBeenCalledOnce();
  });

  it('returns 400 for empty content', async () => {
    const convChain = mockChain({ id: 'conv-1', person_id: 'u1' });
    const supabaseFrom = vi.fn().mockReturnValue(convChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await POST(makeRequest(''), makeParams('conv-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for content over 500 chars', async () => {
    const convChain = mockChain({ id: 'conv-1', person_id: 'u1' });
    const supabaseFrom = vi.fn().mockReturnValue(convChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await POST(makeRequest('a'.repeat(501)), makeParams('conv-1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation not found', async () => {
    const convChain = mockChain(null);
    const supabaseFrom = vi.fn().mockReturnValue(convChain);
    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await POST(makeRequest('Hello'), makeParams('conv-999'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when employer hat', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await POST(makeRequest('Hello'), makeParams('conv-1'));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardUnauth());
    const res = await POST(makeRequest('Hello'), makeParams('conv-1'));
    expect(res.status).toBe(401);
  });

  it('returns 503 when LLM throws and user message is still saved', async () => {
    mockAskDocky.mockRejectedValue(new Error('API down'));

    const convChain = mockChain({ id: 'conv-1', person_id: 'u1' });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(convChain)
      .mockReturnValueOnce(historyChain);

    const insertUserChain = mockChain({ id: 'msg-1' });
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(insertUserChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('Hello'), makeParams('conv-1'));
    expect(res.status).toBe(503);
    // User message was saved (serviceFrom was called for the insert)
    expect(serviceFrom).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/advisor/conversations/[id]/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with messages ordered by created_at', async () => {
    const msgs = [
      { id: 'msg-1', role: 'user', content: 'Hello', sources: null, created_at: '2026-03-17T00:00:00Z' },
      { id: 'msg-2', role: 'assistant', content: 'Hi', sources: [], created_at: '2026-03-17T00:01:00Z' },
    ];

    // First call: ownership check; second call: messages list
    const convChain = mockChain({ id: 'conv-1', person_id: 'u1' });
    const msgsChain = mockChain(msgs);
    msgsChain.order = vi.fn().mockReturnValue({
      ...msgsChain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: msgs, error: null }).then(resolve),
    });
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(convChain)
      .mockReturnValueOnce(msgsChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom));

    const res = await GET(new Request('http://localhost'), makeParams('conv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('user');
  });
});
