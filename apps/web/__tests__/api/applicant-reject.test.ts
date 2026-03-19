import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/applicants/[crewId]/reject/route';

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
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string, crewId: string) => ({
  params: Promise.resolve({ id, crewId }),
});

describe('POST /api/daywork/:id/applicants/:crewId/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        ...guardOk().value,
        person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      },
    });

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only employers');
  });

  it('returns 404 when daywork not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'other' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when application not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain({ id: 'd1', poster_person_id: 'u1' }))
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when application already accepted', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain({ id: 'd1', poster_person_id: 'u1' }))
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'accepted' }));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful rejection', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain({ id: 'd1', poster_person_id: 'u1' }))
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'applied' }));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.REJECTED' }),
    );
  });
});
