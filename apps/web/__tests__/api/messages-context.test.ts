import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/messages/[engagementId]/context/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
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

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

describe('GET /api/messages/:engagementId/context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'c1',
        employer_person_id: 'emp1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with engagement context and other name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
        }),
      )
      .mockReturnValueOnce(
        makeChain({ display_name: 'Captain Smith' }),
      );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.other_name).toBe('Captain Smith');
  });

  it('returns Unknown when other profile not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
        }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.other_name).toBe('Unknown');
  });
});
