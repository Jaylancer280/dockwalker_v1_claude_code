import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/daywork/mine/route';

const mockGetUser = vi.fn();
const mockQuery = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            in: mockQuery,
          }),
        }),
      }),
    })),
  })),
}));

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/daywork/mine${query}`);
}

describe('GET /api/daywork/mine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with dayworks list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const dayworks = [{ id: 'd1', status: 'active' }];

    // The route calls .from().select().eq().order() then optionally .in()
    // We need to mock the chain that resolves without .in() for no filter case
    const mockOrder = vi.fn().mockResolvedValue({ data: dayworks, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder, in: vi.fn() });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(
      (await import('@/lib/supabase/server')).createClient,
    ).mockResolvedValueOnce({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => ({ select: mockSelect })),
    } as never);

    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });
});
