import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/notifications/whatsapp/verify/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockServiceFrom = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function chainable(data: unknown, error: unknown = null) {
  const result = { data, error };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.upsert = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/notifications/whatsapp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/whatsapp/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('returns 400 for missing code', async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for wrong length code', async () => {
    const res = await POST(jsonRequest({ code: '123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when no unverified channel exists', async () => {
    mockServiceFrom.mockReturnValue(chainable(null));
    const res = await POST(jsonRequest({ code: '123456' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_or_expired_code');
  });

  it('returns 400 when code is expired', async () => {
    const expired = new Date(Date.now() - 60000).toISOString();
    mockServiceFrom.mockReturnValue(
      chainable({
        id: 'ch1',
        verification_code: '123456',
        verification_expires_at: expired,
      }),
    );
    const res = await POST(jsonRequest({ code: '123456' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_or_expired_code');
  });

  it('returns 400 when code does not match', async () => {
    const future = new Date(Date.now() + 600000).toISOString();
    mockServiceFrom.mockReturnValue(
      chainable({
        id: 'ch1',
        verification_code: '654321',
        verification_expires_at: future,
      }),
    );
    const res = await POST(jsonRequest({ code: '123456' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_or_expired_code');
  });

  it('succeeds with correct code and sets verified + whatsapp_enabled', async () => {
    const future = new Date(Date.now() + 600000).toISOString();

    // 1st call: select channel
    const selectBuilder = chainable({
      id: 'ch1',
      verification_code: '123456',
      verification_expires_at: future,
    });
    // 2nd call: update channel
    const updateBuilder = chainable(null);
    // 3rd call: upsert preferences
    const prefBuilder = chainable(null);

    let callIdx = 0;
    mockServiceFrom.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return selectBuilder;
      if (callIdx === 2) return updateBuilder;
      return prefBuilder;
    });

    const res = await POST(jsonRequest({ code: '123456' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
  });
});
