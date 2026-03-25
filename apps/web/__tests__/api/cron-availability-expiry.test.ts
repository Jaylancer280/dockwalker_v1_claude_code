import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/availability-expiry/route';

const mockServiceFrom = vi.fn();
const mockServiceRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: mockServiceFrom,
    rpc: mockServiceRpc,
  })),
}));

vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

/** Build a fluent mock where every method returns self, except the terminal resolves data */
function fluent(terminalData: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      gt: vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: terminalData }),
        }),
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: terminalData }),
        }),
      }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: terminalData }),
          }),
        }),
      }),
      order: vi.fn().mockResolvedValue({ data: terminalData }),
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

  it('returns 200 with counts of notified crew', async () => {
    // Trigger 1: rpc returns expiring crew
    mockServiceRpc.mockResolvedValueOnce({ data: [{ person_id: 'crew-1' }], error: null });
    // notifications check crew-1 — no existing
    mockServiceFrom.mockReturnValueOnce(fluent([]));
    // notifications insert crew-1
    mockServiceFrom.mockReturnValueOnce(fluent(null));
    // Trigger 2: stale query — no stale crew
    mockServiceFrom.mockReturnValueOnce(fluent([]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifiedExpiring).toBe(1);
    expect(body.notifiedStale).toBe(0);
  });

  it('skips crew already notified in last 24h', async () => {
    // Trigger 1: rpc returns expiring crew
    mockServiceRpc.mockResolvedValueOnce({ data: [{ person_id: 'crew-1' }], error: null });
    // notifications check — already notified
    mockServiceFrom.mockReturnValueOnce(fluent([{ id: 'existing' }]));
    // Trigger 2: stale query — no stale crew
    mockServiceFrom.mockReturnValueOnce(fluent([]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifiedExpiring).toBe(0);
  });

  it('returns 0 when no expiring availability found', async () => {
    // Trigger 1: rpc returns empty
    mockServiceRpc.mockResolvedValueOnce({ data: [], error: null });
    // Trigger 2: stale query — no stale crew
    mockServiceFrom.mockReturnValueOnce(fluent([]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifiedExpiring).toBe(0);
    expect(body.notifiedStale).toBe(0);
  });
});
