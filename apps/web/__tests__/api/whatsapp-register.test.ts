import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/notifications/whatsapp/register/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

vi.mock('@/lib/crypto', () => ({
  encryptPhone: vi.fn().mockReturnValue(Buffer.from('encrypted')),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
vi.stubGlobal('fetch', mockFetch);

const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      supabase: { from: mockFrom },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function chainable(data: unknown, error: unknown = null) {
  const result = { data, error, count: 0 };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.gte = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockReturnValue(builder);
  builder.upsert = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/notifications/whatsapp/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/whatsapp/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('returns 401 for unauthenticated user', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    });
    const res = await POST(jsonRequest({ phoneNumber: '+33612345678' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid phone format', async () => {
    const res = await POST(jsonRequest({ phoneNumber: '12345' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/E\.164/);
  });

  it('returns 400 for missing phone', async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited (3+ attempts in hour)', async () => {
    // Rate limit check returns count >= 3
    const rateLimitBuilder = chainable(null);
    rateLimitBuilder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      resolve({ data: null, error: null, count: 3 });
      return Promise.resolve({ data: null, error: null, count: 3 });
    });
    mockServiceFrom.mockReturnValue(rateLimitBuilder);

    const res = await POST(jsonRequest({ phoneNumber: '+33612345678' }));
    expect(res.status).toBe(429);
  });

  it('succeeds with valid phone number', async () => {
    // Rate limit check: count = 0
    const rateLimitBuilder = chainable(null);
    rateLimitBuilder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      resolve({ data: null, error: null, count: 0 });
      return Promise.resolve({ data: null, error: null, count: 0 });
    });
    // Upsert: success
    const upsertBuilder = chainable(null);

    let callIdx = 0;
    mockServiceFrom.mockImplementation(() => {
      callIdx++;
      return callIdx === 1 ? rateLimitBuilder : upsertBuilder;
    });

    const res = await POST(jsonRequest({ phoneNumber: '+33612345678' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
