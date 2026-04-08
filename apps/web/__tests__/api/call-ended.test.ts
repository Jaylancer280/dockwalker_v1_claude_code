import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/messages/[engagementId]/call-ended/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockRpc = vi.fn();
const mockFromAuth = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk(userId = 'u1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc, from: mockFromAuth },
    },
  };
}

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/messages/[engagementId]/call-ended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not a participant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        status: 'active',
        crew_person_id: 'other',
        employer_person_id: 'other2',
      }),
    );

    const res = await POST(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        status: 'completed',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );

    const res = await POST(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('creates system message with formatted duration on success', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        status: 'active',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ duration: 125 }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'MESSAGE.SENT',
        p_aggregate_id: 'e1',
      }),
    );
  });
});
