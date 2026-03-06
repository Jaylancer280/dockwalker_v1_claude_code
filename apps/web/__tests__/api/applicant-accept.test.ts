import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/[id]/applicants/[crewId]/accept/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

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

const makeParams = (id: string, crewId: string) => ({
  params: Promise.resolve({ id, crewId }),
});

describe('POST /api/daywork/:id/applicants/:crewId/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when daywork not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'd1',
        poster_person_id: 'other',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        status: 'active',
      }),
    );

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when posting not active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'd1',
        poster_person_id: 'u1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        status: 'completed',
      }),
    );

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when application not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1',
          poster_person_id: 'u1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
          status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when application already rejected', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1',
          poster_person_id: 'u1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
          status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'rejected' }));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 when crew has conflicting engagement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1',
          poster_person_id: 'u1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
          status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'applied' }));
    mockRpc.mockResolvedValueOnce({ data: false });

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('conflicting');
  });

  it('returns 200 on successful accept', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'd1',
          poster_person_id: 'u1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
          status: 'active',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'viewed' }));
    mockRpc
      .mockResolvedValueOnce({ data: true }) // check_no_overlap
      .mockResolvedValueOnce({ error: null }); // append_event

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.ACCEPTED' }),
    );
  });
});
