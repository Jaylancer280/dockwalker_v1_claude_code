import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET } from '@/app/api/cron/document-cleanup/route';

const mockCreateServiceClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  return new Request('http://localhost/api/cron/document-cleanup', { headers });
}

function mockServiceClient(expired: unknown[] = [], orphans: unknown[] = [], staleCount = 0) {
  const removeFn = vi.fn().mockResolvedValue({});
  const storage = { from: vi.fn().mockReturnValue({ remove: removeFn }) };
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  const fromFn = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockImplementation((_sel: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        return {
          lt: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: staleCount }),
          }),
        };
      }
      return {
        lt: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: expired }),
        }),
        not: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: orphans }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue(updateChain),
  }));

  return { from: fromFn, storage };
}

describe('GET /api/cron/document-cleanup', () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it('returns 401 without valid CRON_SECRET', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 without authorization header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns cleaned count on success', async () => {
    const sc = mockServiceClient(
      [{ id: 'doc1', storage_path: 'path/doc1.pdf' }],
      [],
      0,
    );
    mockCreateServiceClient.mockResolvedValue(sc);

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleaned).toBe(1);
    expect(body.orphans).toBe(0);
    expect(body.stragglers).toBe(0);
  });

  it('returns zero counts when no expired documents', async () => {
    const sc = mockServiceClient([], [], 0);
    mockCreateServiceClient.mockResolvedValue(sc);

    const res = await GET(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleaned).toBe(0);
  });
});
