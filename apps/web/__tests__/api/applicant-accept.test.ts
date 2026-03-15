import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/applicants/[crewId]/accept/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();
const mockServiceFrom = vi.fn();

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
      serviceClient: { rpc: mockRpc, from: mockServiceFrom },
    },
  };
}

const makeParams = (id: string, crewId: string) => ({
  params: Promise.resolve({ id, crewId }),
});

describe('POST /api/daywork/:id/applicants/:crewId/accept', () => {
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

  it('returns 404 when daywork not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'd1', poster_person_id: 'other',
        start_date: '2026-04-01', end_date: '2026-04-05', status: 'active',
      }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when posting not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'd1', poster_person_id: 'u1',
        start_date: '2026-04-01', end_date: '2026-04-05', status: 'completed',
      }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when application not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1', poster_person_id: 'u1',
          start_date: '2026-04-01', end_date: '2026-04-05', status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when application already rejected', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1', poster_person_id: 'u1',
          start_date: '2026-04-01', end_date: '2026-04-05', status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'rejected' }));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(400);
  });

  it('returns 409 when crew has conflicting engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1', poster_person_id: 'u1',
          start_date: '2026-04-01', end_date: '2026-04-05', status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'applied' }));
    mockRpc.mockResolvedValueOnce({ data: false });

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('conflicting');
  });

  it('returns 200 with engagementId on successful accept', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1', poster_person_id: 'u1',
          start_date: '2026-04-01', end_date: '2026-04-05', status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'viewed' }));
    mockRpc
      .mockResolvedValueOnce({ data: true })
      .mockResolvedValueOnce({ error: null });
    mockServiceFrom.mockReturnValueOnce(makeChain({ id: 'eng-123' }));

    const res = await POST(new Request('http://localhost'), makeParams('d1', 'c1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.engagementId).toBe('eng-123');
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'check_no_overlap', {
      p_crew_person_id: 'c1',
      p_daywork_id: 'd1',
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.ACCEPTED' }),
    );
  });
});
