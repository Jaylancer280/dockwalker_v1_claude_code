import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/[id]/applicants/[crewId]/view/route';

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

describe('POST /api/daywork/:id/applicants/:crewId/view', () => {
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

  it('returns 403 when not the poster', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when application not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', poster_person_id: 'u1' }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with alreadyViewed when not in applied state', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', poster_person_id: 'u1' }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'viewed' }));

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyViewed).toBe(true);
  });

  it('returns 200 and emits event when applied', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', poster_person_id: 'u1' }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'applied' }));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      new Request('http://localhost'),
      makeParams('d1', 'c1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.VIEWED' }),
    );
  });
});
