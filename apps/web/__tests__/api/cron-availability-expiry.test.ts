import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/availability-expiry/route';

const mockServiceFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: mockServiceFrom,
  })),
}));

vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

/** Build a fluent mock where every method returns self, except the terminal resolves data */
function fluent(terminalData: unknown) {
  const obj: Record<string, unknown> = {};
  const self = new Proxy(obj, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // not thenable until terminal
      return (..._args: unknown[]) => self;
    },
  });
  // Override specific terminals
  return {
    select: vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: terminalData }),
        }),
      }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: terminalData }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('GET /api/cron/availability-expiry', () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  function makeRequest(secret?: string) {
    const headers: Record<string, string> = {};
    if (secret) headers['authorization'] = `Bearer ${secret}`;
    return new Request('http://localhost/api/cron/availability-expiry', { headers });
  }

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 with no authorization header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with count of notified crew', async () => {
    // availability_windows query — 2 crew expiring
    mockServiceFrom.mockReturnValueOnce(
      fluent([{ person_id: 'crew-1' }, { person_id: 'crew-2' }]),
    );
    // notifications check crew-1 — no existing
    mockServiceFrom.mockReturnValueOnce(fluent([]));
    // notifications insert crew-1
    mockServiceFrom.mockReturnValueOnce(fluent(null));
    // notifications check crew-2 — no existing
    mockServiceFrom.mockReturnValueOnce(fluent([]));
    // notifications insert crew-2
    mockServiceFrom.mockReturnValueOnce(fluent(null));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(2);
  });

  it('skips crew already notified in last 24h', async () => {
    // availability_windows query — 1 crew expiring
    mockServiceFrom.mockReturnValueOnce(fluent([{ person_id: 'crew-1' }]));
    // notifications check — already notified
    mockServiceFrom.mockReturnValueOnce(fluent([{ id: 'existing' }]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(0);
  });

  it('returns 0 when no expiring availability found', async () => {
    mockServiceFrom.mockReturnValueOnce(fluent([]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notified).toBe(0);
  });
});
