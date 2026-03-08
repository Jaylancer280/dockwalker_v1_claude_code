import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as cancelCrew } from '@/app/api/engagements/[id]/cancel-crew/route';
import { POST as cancelEmployer } from '@/app/api/engagements/[id]/cancel-employer/route';

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

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/engagements/:id/cancel-crew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await cancelCrew(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await cancelCrew(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the crew member', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'other', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'completed' }),
    );

    const res = await cancelCrew(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful crew cancellation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await cancelCrew(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.CANCELLED_BY_CREW' }),
    );
  });
});

describe('POST /api/engagements/:id/cancel-employer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'other',
        daywork_id: 'd1', status: 'active',
      }),
    );

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'cancelled',
      }),
    );

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful employer cancellation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'active',
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' }),
    );
  });
});
