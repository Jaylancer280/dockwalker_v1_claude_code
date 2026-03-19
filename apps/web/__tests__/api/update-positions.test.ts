import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/update-positions/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk(hat: 'employer' | 'agent' | 'crew' = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: hat },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const activeDaywork = {
  id: 'd1',
  poster_person_id: 'u1',
  status: 'active',
  positions_available: 3,
  positions_filled: 1,
};

describe('POST /api/daywork/:id/update-positions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on happy path — increase positions', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ positionsAvailable: 5 }), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.positions_available).toBe(5);
    expect(body.positions_filled).toBe(1);
  });

  it('returns 200 on happy path — decrease positions above filled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ positionsAvailable: 2 }), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.positions_available).toBe(2);
  });

  it('returns 400 when decreasing below filled count', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain({ ...activeDaywork, positions_filled: 3 }));

    const res = await POST(makeRequest({ positionsAvailable: 2 }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('filled count');
  });

  it('returns 400 for invalid positionsAvailable — zero', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));

    const res = await POST(makeRequest({ positionsAvailable: 0 }), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid positionsAvailable — negative', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));

    const res = await POST(makeRequest({ positionsAvailable: -1 }), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid positionsAvailable — exceeds 20', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));

    const res = await POST(makeRequest({ positionsAvailable: 21 }), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer positionsAvailable', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeDaywork));

    const res = await POST(makeRequest({ positionsAvailable: 'abc' }), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user has crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew'));

    const res = await POST(makeRequest({ positionsAvailable: 5 }), makeParams('d1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only employers');
  });

  it('returns 403 when not the owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeDaywork, poster_person_id: 'other' }),
    );

    const res = await POST(makeRequest({ positionsAvailable: 5 }), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when daywork is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeDaywork, status: 'completed' }),
    );

    const res = await POST(makeRequest({ positionsAvailable: 5 }), makeParams('d1'));
    expect(res.status).toBe(400);
  });
});
