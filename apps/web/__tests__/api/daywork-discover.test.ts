import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/daywork/discover/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
    rpc: mockRpc,
  })),
}));

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/daywork/discover${query}`);
}

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
        in: vi.fn().mockResolvedValue({ data }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
      in: vi.fn().mockResolvedValue({ data }),
    }),
  };
}

describe('GET /api/daywork/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when not crew hat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only crew');
  });

  it('returns 200 with filtered dayworks', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    // persons query
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'crew' }));
    // applications query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // availability windows query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // dayworks query
    const dayworks = [
      {
        id: 'd1',
        vessel_id: 'v1',
        poster_person_id: 'other',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: dayworks, error: null }),
          }),
        }),
      }),
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: 'v1',
          imo_number: null,
          name: 'NDA Vessel',
          vessel_type: 'private',
          size_band_id: 'sb1',
          size_band_label: '40-50m',
          nda_flag: true,
          owner_person_id: 'owner1',
        },
      ],
      error: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toBeDefined();
    expect(body.dayworks[0].vessels).toEqual({
      name: 'NDA Vessel',
      nda_flag: true,
      vessel_type: 'private',
      vessel_size_bands: { label: '40-50m' },
    });
  });
});
