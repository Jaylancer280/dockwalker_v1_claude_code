import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/invitation-expiry/route';

const mockServiceFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: mockServiceFrom,
  })),
}));

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  return new Request('http://localhost/api/cron/invitation-expiry', {
    method: 'GET',
    headers,
  });
}

/**
 * Returns a chain that mimics the route's
 * `.from(...).update(...).eq(...).lt(...).select(...)` shape,
 * resolving to `{ data, error }` from the terminal `.select(...)`.
 */
function expiryChain(data: unknown[] | null, error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.update = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.lt = vi.fn().mockReturnValue(self);
  self.select = vi.fn().mockResolvedValue({ data, error });
  return self;
}

describe('GET /api/cron/invitation-expiry', () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it('401s on missing bearer token', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it('401s on wrong bearer token', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('401s when CRON_SECRET env is missing (defence)', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest('anything'));
    expect(res.status).toBe(401);
  });

  it('updates pending invitations older than 30 days to expired', async () => {
    const chain = expiryChain([{ id: 'inv-1' }, { id: 'inv-2' }, { id: 'inv-3' }]);
    mockServiceFrom.mockReturnValue(chain);

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(3);

    expect(mockServiceFrom).toHaveBeenCalledWith('permanent_invitations');
    expect(chain.update).toHaveBeenCalledWith({ status: 'expired' });
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
    // Cutoff is now() - 30 days. We don't pin the timestamp exactly but
    // assert the .lt() call used a reasonable past ISO string.
    const cutoffArg = chain.lt.mock.calls[0]![1];
    expect(typeof cutoffArg).toBe('string');
    const cutoff = new Date(cutoffArg as string);
    const ageMs = Date.now() - cutoff.getTime();
    expect(ageMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  it('returns expired:0 when no rows match (idempotent re-run)', async () => {
    mockServiceFrom.mockReturnValue(expiryChain([]));
    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    expect((await res.json()).expired).toBe(0);
  });

  it('returns 500 when the UPDATE errors', async () => {
    mockServiceFrom.mockReturnValue(expiryChain(null, { message: 'db down' }));
    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(500);
  });
});
