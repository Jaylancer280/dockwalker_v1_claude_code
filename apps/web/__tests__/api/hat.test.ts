import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/hat/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockRpc = vi.fn();

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/hat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: {},
      serviceClient: { rpc: mockRpc },
      ...overrides,
    },
  };
}

describe('POST /api/hat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ hat: 'crew' }));
    expect(res.status).toBe(401);
  });

  it('returns 409 when onboarding incomplete', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    });

    const res = await POST(makeRequest({ hat: 'crew' }));
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid hat value', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ hat: 'admiral' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid hat');
  });

  it('returns 403 when agent tries to switch hats', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'agent', current_hat: 'agent' } }),
    );

    const res = await POST(makeRequest({ hat: 'crew' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Agents cannot switch hats');
  });

  it('returns 200 no-op when already wearing the requested hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await POST(makeRequest({ hat: 'employer' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hat).toBe('employer');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 200 and switches hat for crew identity', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ error: null });

    const res = await POST(makeRequest({ hat: 'employer' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hat).toBe('employer');
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'PERSON.HAT_CHANGED',
        p_payload: { current_hat: 'employer' },
      }),
    );
  });
});
