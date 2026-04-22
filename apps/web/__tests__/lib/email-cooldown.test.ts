import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    set = mockSet;
    incr = mockIncr;
    expire = mockExpire;
  },
}));

describe('canSendEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockSet.mockReset();
    mockIncr.mockReset();
    mockExpire.mockReset();
  });

  it('returns true (allow all) when Upstash env vars are missing', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const { canSendEmail } = await import('@/lib/email/cooldown');

    expect(await canSendEmail('p1', 'message', 'e1')).toBe(true);
    expect(await canSendEmail('p1', 'applied', 'd1')).toBe(true);
    expect(await canSendEmail('p1', 'other')).toBe(true);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("message kind: first call returns true, same resource within window returns false", async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    // First call: SET NX succeeds, daily count = 1, expire is set
    mockSet.mockResolvedValueOnce('OK');
    mockIncr.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    expect(await canSendEmail('p1', 'message', 'eng1')).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      'email:cd:msg:p1:eng1',
      '1',
      { ex: 15 * 60, nx: true },
    );

    // Second call for same (recipient, engagement): SET NX returns null
    mockSet.mockResolvedValueOnce(null);
    expect(await canSendEmail('p1', 'message', 'eng1')).toBe(false);
    // Daily counter NOT incremented on blocked send
    expect(mockIncr).toHaveBeenCalledTimes(1);
  });

  it('applied kind: 60-min cooldown per (poster × daywork)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockSet.mockResolvedValueOnce('OK');
    mockIncr.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    expect(await canSendEmail('poster1', 'applied', 'dw42')).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      'email:cd:app:poster1:dw42',
      '1',
      { ex: 60 * 60, nx: true },
    );
  });

  it('other kind: no per-event cooldown, only daily cap', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockIncr.mockResolvedValueOnce(5);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    expect(await canSendEmail('p1', 'other')).toBe(true);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockIncr).toHaveBeenCalledTimes(1);
  });

  it('daily cap: returns false when count exceeds 20', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockIncr.mockResolvedValueOnce(21);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    expect(await canSendEmail('p1', 'other')).toBe(false);
  });

  it('daily cap: first call (count=1) sets 24h TTL', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockIncr.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    await canSendEmail('p1', 'other');
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringMatching(/^email:cd:day:p1:\d{4}-\d{2}-\d{2}$/),
      24 * 60 * 60,
    );
  });

  it('daily cap: subsequent calls (count>1) do NOT re-set TTL', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockIncr.mockResolvedValueOnce(7);

    const { canSendEmail } = await import('@/lib/email/cooldown');
    await canSendEmail('p1', 'other');
    expect(mockExpire).not.toHaveBeenCalled();
  });
});
