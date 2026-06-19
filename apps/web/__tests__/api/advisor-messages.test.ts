import { describe, it, expect, vi, beforeEach } from 'vitest';

// after() from next/server needs a request context not available in vitest.
// Mock as a no-op — these tests cover request/response behaviour, not the
// post-response persistence which is exercised by integration tests.
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: () => {},
  };
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
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
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
      serviceClient: { from: serviceFromFn ?? fromFn, rpc: vi.fn().mockResolvedValue({ data: 1 }) },
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

function makeMockStream(text = 'Mock answer from Docky') {
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
    completion: Promise.resolve({
      text,
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-haiku-4-5-20251001',
    }),
  };
}

describe('POST /api/advisor/thread/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockStreamDocky.mockReturnValue(makeMockStream());
    mockBuildCrewContext.mockResolvedValue({ markdown: '', certNames: [], roleName: '' });
  });

  it('returns streaming response on happy path (existing thread)', async () => {
    const now = new Date().toISOString();
    const threadChain = mockChain({ id: 'thread-1', created_at: now });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(threadChain)
      .mockReturnValueOnce(historyChain);

    const usageCheckChain = mockChain(null);
    const insertUserChain = mockChain({ id: 'msg-1' });
    const insertAssistantChain = mockChain({ id: 'msg-2' });
    const updateChain = mockChain(null);
    const interactionChain = mockChain(null);
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(usageCheckChain)
      .mockReturnValueOnce(insertUserChain)
      .mockReturnValueOnce(insertAssistantChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(interactionChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('What certs do I need?'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(mockStreamDocky).toHaveBeenCalledOnce();
  });

  it('auto-creates thread if none exists', async () => {
    const noThreadChain = mockChain(null, { code: 'PGRST116' });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(noThreadChain)
      .mockReturnValueOnce(historyChain);

    const createThreadChain = mockChain({ id: 'new-thread' });
    const usageCheckChain = mockChain(null);
    const insertUserChain = mockChain({ id: 'msg-1' });
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(createThreadChain)
      .mockReturnValueOnce(usageCheckChain)
      .mockReturnValueOnce(insertUserChain);

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

  it('returns 503 when streamDocky throws and user message is still saved', async () => {
    mockStreamDocky.mockImplementation(() => { throw new Error('API down'); });

    const now = new Date().toISOString();
    const threadChain = mockChain({ id: 'thread-1', created_at: now });
    const historyChain = mockChain([]);
    const supabaseFrom = vi.fn()
      .mockReturnValueOnce(threadChain)
      .mockReturnValueOnce(historyChain);

    const usageCheckChain = mockChain(null);
    const insertUserChain = mockChain({ id: 'msg-1' });
    const serviceFrom = vi.fn()
      .mockReturnValueOnce(usageCheckChain)
      .mockReturnValueOnce(insertUserChain);

    mockRequireDomainUser.mockResolvedValue(guardOk(supabaseFrom, serviceFrom));

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(503);
    // Usage check + user message saved (serviceFrom called twice)
    expect(serviceFrom).toHaveBeenCalledTimes(2);
  });
});
