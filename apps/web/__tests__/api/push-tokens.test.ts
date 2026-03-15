import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST, DELETE } from '@/app/api/push-tokens/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
      ...overrides,
    },
  };
}

function jsonRequest(method: string, body: Record<string, unknown>) {
  return new Request('http://localhost/api/push-tokens', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/push-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(jsonRequest('POST', { token: 'abc', platform: 'apns' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when token missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest('POST', { platform: 'apns' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('token');
  });

  it('returns 400 when platform invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest('POST', { token: 'abc123', platform: 'invalid' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('platform');
  });

  it('returns 201 on successful upsert', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(jsonRequest('POST', { token: 'device-token-123', platform: 'apns' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('passes correct data to upsert', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ upsert: mockUpsert });

    await POST(jsonRequest('POST', { token: 'device-token-123', platform: 'fcm' }));

    expect(mockFrom).toHaveBeenCalledWith('device_tokens');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 'u1',
        token: 'device-token-123',
        platform: 'fcm',
      }),
      { onConflict: 'person_id,token' },
    );
  });
});

describe('DELETE /api/push-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await DELETE(jsonRequest('DELETE', { token: 'abc' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when token missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await DELETE(jsonRequest('DELETE', {}));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful delete', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const res = await DELETE(jsonRequest('DELETE', { token: 'device-token-123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
