import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/daywork/[id]/applicants/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
}));

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
        eq: vi.fn().mockResolvedValue({ data, error }),
      }),
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data, error }),
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            gt: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    }),
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/daywork/:id/applicants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when daywork not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
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
      }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with enriched applicants', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    // daywork query
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'd1',
        poster_person_id: 'u1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      }),
    );
    // applications query
    const apps = [
      { id: 'a1', crew_person_id: 'c1', status: 'applied', created_at: '2026-03-01' },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // availability windows query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
    });
    // past engagements query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].available_days).toBe(0);
    expect(body.applicants[0].past_daywork_count).toBe(0);
  });
});
