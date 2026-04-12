import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/account/deactivate/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockRpc = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: {},
      serviceClient: {
        rpc: mockRpc,
        auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
      },
      ...overrides,
    },
  };
}

describe('POST /api/account/deactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST();
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

    const res = await POST();
    expect(res.status).toBe(409);
  });

  it('appends PERSON.DEACTIVATED event and returns 200', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ error: null });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'PERSON.DEACTIVATED',
        p_aggregate_id: 'u1',
        p_person_id: 'u1',
        p_payload: {},
      }),
    );
  });

  it('returns 500 when event append fails', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ error: { message: 'DB error' } });

    const res = await POST();
    expect(res.status).toBe(500);
  });
});
