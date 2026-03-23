import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockServiceFrom } = vi.hoisted(() => ({
  mockServiceFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockServiceFrom(...args),
    auth: { admin: { getUserById: vi.fn() } },
  }),
}));

vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/push-triggers', () => ({
  getRecipientEmail: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/push-triggers/loaders', () => ({
  hasPushTokens: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email/templates', () => ({
  engagementStartingEmail: vi.fn().mockReturnValue({
    subject: 'Your engagement starts tomorrow',
    html: '<p>test</p>',
  }),
}));

import { GET } from '@/app/api/cron/engagement-starts/route';

function makeChain(data: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.limit = vi.fn().mockReturnValue({ then: (r: (v: unknown) => void) => r({ data }) });
  chain.like = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  // Make the chain itself thenable for awaited queries without .limit()
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data }),
    configurable: true,
    writable: true,
  });
  return chain;
}

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('GET /api/cron/engagement-starts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 401 without valid CRON_SECRET', async () => {
    const req = new Request('http://localhost/api/cron/engagement-starts');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns notified: 0 when no engagements start tomorrow', async () => {
    mockServiceFrom.mockReturnValueOnce(makeChain([]));

    const req = new Request('http://localhost/api/cron/engagement-starts', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(0);
  });

  it('notifies both crew and employer for engagement starting tomorrow', async () => {
    const engagement = {
      id: 'eng-1',
      crew_person_id: 'crew-1',
      employer_person_id: 'emp-1',
      start_date: tomorrow,
      daywork_id: 'dw-1',
    };

    // 1. engagements query
    mockServiceFrom.mockReturnValueOnce(makeChain([engagement]));
    // 2. profiles
    mockServiceFrom.mockReturnValueOnce(
      makeChain([
        { person_id: 'crew-1', display_name: 'Jane' },
        { person_id: 'emp-1', display_name: 'Bob' },
      ]),
    );
    // 3. dayworks
    mockServiceFrom.mockReturnValueOnce(makeChain([{ id: 'dw-1', yacht_roles: { name: 'Deckhand' } }]));
    // 4. duplicate check crew → none
    mockServiceFrom.mockReturnValueOnce(makeChain([]));
    // 5. notification insert crew
    mockServiceFrom.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) });
    // 6. duplicate check employer → none
    mockServiceFrom.mockReturnValueOnce(makeChain([]));
    // 7. notification insert employer
    mockServiceFrom.mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) });

    const req = new Request('http://localhost/api/cron/engagement-starts', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(2);
  });

  it('skips already-notified persons (duplicate prevention)', async () => {
    const engagement = {
      id: 'eng-1',
      crew_person_id: 'crew-1',
      employer_person_id: 'emp-1',
      start_date: tomorrow,
      daywork_id: 'dw-1',
    };

    mockServiceFrom.mockReturnValueOnce(makeChain([engagement]));
    mockServiceFrom.mockReturnValueOnce(makeChain([]));
    mockServiceFrom.mockReturnValueOnce(makeChain([]));
    // duplicate check crew → FOUND
    mockServiceFrom.mockReturnValueOnce(makeChain([{ id: 'existing' }]));
    // duplicate check employer → FOUND
    mockServiceFrom.mockReturnValueOnce(makeChain([{ id: 'existing-2' }]));

    const req = new Request('http://localhost/api/cron/engagement-starts', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(0);
  });

  it('queries only active engagements', async () => {
    mockServiceFrom.mockReturnValueOnce(makeChain([]));

    const req = new Request('http://localhost/api/cron/engagement-starts', {
      headers: { authorization: 'Bearer test-secret' },
    });
    await GET(req);
    expect(mockServiceFrom).toHaveBeenCalledWith('active_engagements');
  });
});
