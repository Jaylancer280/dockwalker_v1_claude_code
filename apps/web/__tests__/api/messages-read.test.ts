import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'u1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

function makeRequest(): Request {
  return new Request('http://localhost/api/messages/e1/read', {
    method: 'POST',
  });
}

describe('POST /api/messages/:engagementId/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks messages as read for a participant → 200', async () => {
    const engagement = { id: 'e1', crew_person_id: 'u1', employer_person_id: 'u2' };
    mockRequireDomainUser.mockResolvedValue(guardOk('u1'));
    mockFromAuth.mockReturnValueOnce(makeChain(engagement));
    mockFromAuth.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { POST } = await import('@/app/api/messages/[engagementId]/read/route');
    const res = await POST(makeRequest(), makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it('returns 403 when user is not a participant', async () => {
    const engagement = { id: 'e1', crew_person_id: 'other1', employer_person_id: 'other2' };
    mockRequireDomainUser.mockResolvedValue(guardOk('u1'));
    mockFromAuth.mockReturnValueOnce(makeChain(engagement));

    const { POST } = await import('@/app/api/messages/[engagementId]/read/route');
    const res = await POST(makeRequest(), makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Not a participant in this engagement');
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1'));
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const { POST } = await import('@/app/api/messages/[engagementId]/read/route');
    const res = await POST(makeRequest(), makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Engagement not found');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const { POST } = await import('@/app/api/messages/[engagementId]/read/route');
    const res = await POST(makeRequest(), makeParams('e1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});
