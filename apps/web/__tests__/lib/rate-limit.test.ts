import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockLimit = vi.fn();

class MockRatelimit {
  limit = mockLimit;
  static slidingWindow = vi.fn();
}

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: MockRatelimit,
}));

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {},
}));

function makeRequest(path: string, method = 'GET'): NextRequest {
  return {
    method,
    headers: {
      get: (name: string) => (name === 'x-forwarded-for' ? '1.2.3.4' : null),
    },
    nextUrl: { pathname: path },
  } as unknown as NextRequest;
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockLimit.mockReset();
  });

  it('returns null when env vars not configured (graceful no-op)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/api/daywork'));
    expect(result).toBeNull();
  });

  it('returns null for /api/health (exempt)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/api/health'));
    expect(result).toBeNull();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('returns null for non-API paths (pages not rate limited)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/discover'));
    expect(result).toBeNull();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when global limit exceeded', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    mockLimit.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 30000 });
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/api/daywork'));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    const body = await result!.json();
    expect(body.error).toBe('Too many requests');
  });

  it('returns 429 on write limit exceeded (POST)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    // Global passes, write fails
    mockLimit
      .mockResolvedValueOnce({ success: true, remaining: 50, reset: Date.now() + 60000 })
      .mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 30000 });
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/api/daywork', 'POST'));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });

  it('returns null for webhook paths (exempt)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    const { checkRateLimit } = await import('@/lib/rate-limit');

    const result = await checkRateLimit(makeRequest('/api/webhooks/stripe'));
    expect(result).toBeNull();
    expect(mockLimit).not.toHaveBeenCalled();
  });
});
