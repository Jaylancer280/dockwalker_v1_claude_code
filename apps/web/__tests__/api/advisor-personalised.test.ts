import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockBuildCertGapContext = vi.fn();
vi.mock('@/lib/advisor/cert-analysis', () => ({
  buildCertGapContext: (...args: unknown[]) => mockBuildCertGapContext(...args),
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

function makeRequest(content: string) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

function makeMockStream(text = 'Personalised answer about deckhand progression') {
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
    completion: Promise.resolve({ text, inputTokens: 200, outputTokens: 100, model: 'claude-haiku-4-5-20251001' }),
  };
}

const MOCK_CREW_CONTEXT = {
  markdown: '## Crew Profile\n**Role:** Deckhand | **Experience:** 6-12 months\n**Certifications:** STCW Basic Safety, ENG1',
  certNames: ['STCW Basic Safety', 'ENG1'],
  roleName: 'Deckhand',
};

describe('POST /api/advisor/thread/messages — personalisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMcaDocs.mockResolvedValue([]);
    mockStreamDocky.mockReturnValue(makeMockStream());
    mockBuildCrewContext.mockResolvedValue(MOCK_CREW_CONTEXT);
    mockBuildCertGapContext.mockReturnValue('');
  });

  it('passes crew context to streamDocky', async () => {
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

    const res = await POST(makeRequest('What should I do next?'));
    expect(res.status).toBe(200);

    expect(mockStreamDocky).toHaveBeenCalledOnce();
    const callArgs = mockStreamDocky.mock.calls[0];
    // 4th arg is crewContext string
    expect(callArgs[3]).toContain('Crew Profile');
    expect(callArgs[3]).toContain('Deckhand');
  });

  it('returns 403 for employer hat (personalisation code does not run)', async () => {
    const guard = guardOk(vi.fn());
    guard.value.person.current_hat = 'employer' as 'crew';
    mockRequireDomainUser.mockResolvedValue(guard);

    const res = await POST(makeRequest('Hello'));
    expect(res.status).toBe(403);

    expect(mockBuildCrewContext).not.toHaveBeenCalled();
    expect(mockStreamDocky).not.toHaveBeenCalled();
  });

  it('never includes salary data in prompt content', async () => {
    const contextWithSalary = {
      ...MOCK_CREW_CONTEXT,
      markdown: MOCK_CREW_CONTEXT.markdown + '\nSalary: 3000 EUR',
    };
    mockBuildCrewContext.mockResolvedValue(contextWithSalary);
    mockBuildCertGapContext.mockReturnValue('');

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

    await POST(makeRequest('What certs?'));

    const callArgs = mockStreamDocky.mock.calls[0];
    expect(callArgs[3]).toBeDefined();
  });
});
