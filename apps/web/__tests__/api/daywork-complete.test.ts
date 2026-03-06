import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/[id]/complete/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  })),
}));

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/daywork/:id/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when daywork not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'other', status: 'active' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when not active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'u1', status: 'cancelled' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful completion', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'u1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.COMPLETED' }),
    );
  });
});
