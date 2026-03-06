import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/messages/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
}));

describe('GET /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with conversations list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const crewEngagements = [
      {
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        daywork_id: 'd1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        status: 'active',
      },
    ];
    const employerEngagements: never[] = [];

    // as crew query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: crewEngagements }),
        }),
      }),
    });
    // as employer query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: employerEngagements }),
        }),
      }),
    });
    // messages query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].role).toBe('crew');
  });

  it('returns empty conversations when no engagements', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    mockFromAuth
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toEqual([]);
  });
});
