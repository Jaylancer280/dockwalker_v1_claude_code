import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/data-scrub/route';

const mockServiceFrom = vi.fn();
const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: mockServiceFrom,
  })),
}));

vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

/**
 * Build a fluent mock chain. Pass terminal data; every chained method
 * returns self until the chain is awaited (then resolves with the data).
 */
function fluent(terminalData: unknown, error: { message: string } | null = null) {
  const result = { data: terminalData, error };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.lt = vi.fn().mockReturnValue(self);
  self.not = vi.fn().mockReturnValue(self);
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return self;
}

describe('GET /api/cron/data-scrub', () => {
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
    return new Request('http://localhost/api/cron/data-scrub', { headers });
  }

  it('returns 401 with no auth header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await GET(makeRequest('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns 0 scrubbed when no candidates exist', async () => {
    // Step 1: persons query — no candidates
    mockServiceFrom.mockReturnValueOnce(fluent([]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scrubbed).toBe(0);
    expect(body.eligible).toBe(0);
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('scrubs persons deactivated 30+ days ago, skipping already-scrubbed', async () => {
    // Step 1: 3 candidates
    mockServiceFrom.mockReturnValueOnce(
      fluent([
        { id: 'p1', deactivated_at: '2026-01-01T00:00:00Z' },
        { id: 'p2', deactivated_at: '2026-01-15T00:00:00Z' },
        { id: 'p3', deactivated_at: '2026-02-01T00:00:00Z' },
      ]),
    );
    // Step 2: events query — p2 was already scrubbed
    mockServiceFrom.mockReturnValueOnce(fluent([{ aggregate_id: 'p2' }]));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toBe(3);
    expect(body.eligible).toBe(2); // p1 + p3
    expect(body.scrubbed).toBe(2);
    expect(mockAppendEvent).toHaveBeenCalledTimes(2);
    // Each call uses a deterministic idempotency key
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PERSON.DATA_SCRUBBED',
        aggregateId: 'p1',
        personId: 'p1',
        idempotencyKey: 'PERSON.DATA_SCRUBBED:auto:p1',
      }),
    );
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PERSON.DATA_SCRUBBED',
        aggregateId: 'p3',
        personId: 'p3',
        idempotencyKey: 'PERSON.DATA_SCRUBBED:auto:p3',
      }),
    );
  });

  it('returns 500 when persons query errors', async () => {
    mockServiceFrom.mockReturnValueOnce(fluent(null, { message: 'DB down' }));

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB down');
  });

  it('captures per-person failures without aborting the run', async () => {
    mockServiceFrom.mockReturnValueOnce(
      fluent([
        { id: 'good', deactivated_at: '2026-01-01T00:00:00Z' },
        { id: 'bad', deactivated_at: '2026-01-01T00:00:00Z' },
      ]),
    );
    mockServiceFrom.mockReturnValueOnce(fluent([])); // none already scrubbed

    // Mock appendEvent to fail for 'bad' but succeed for 'good'
    mockAppendEvent.mockImplementation((_sc, params: { aggregateId: string }) => {
      if (params.aggregateId === 'bad') {
        return Promise.reject(new Error('projection blew up'));
      }
      return Promise.resolve('evt-1');
    });

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scrubbed).toBe(1);
    expect(body.eligible).toBe(2);
    expect(body.failures).toEqual([{ personId: 'bad', error: 'projection blew up' }]);
  });
});
