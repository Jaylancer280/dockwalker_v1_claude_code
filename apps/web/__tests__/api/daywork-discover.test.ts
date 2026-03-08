import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/discover/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/daywork/discover${query}`);
}

describe('GET /api/daywork/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 409 when onboarding incomplete', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(409);
  });

  it('returns 403 when not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only crew');
  });

  it('returns 200 with filtered dayworks', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // applications query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // dayworks query: .from().select().eq('status').order().limit()
    const dayworks = [
      {
        id: 'd1',
        vessel_id: 'v1',
        poster_person_id: 'other',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      },
    ];
    const mockLimit = vi.fn().mockResolvedValue({ data: dayworks, error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: mockOrder,
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

  it('returns jobs even when crew has no availability set', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // applications query — no prior applications
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // dayworks query
    const dayworks = [
      { id: 'd1', vessel_id: null, poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
    ];
    const mockLimit = vi.fn().mockResolvedValue({ data: dayworks, error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toHaveLength(1);
  });

  it('does not accept sort parameter', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // applications query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // dayworks query
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });

    const res = await GET(makeRequest('?sort=proximity'));
    expect(res.status).toBe(200);
    // Only recency ordering is used regardless of sort param
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('passes date filters to query', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // applications query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // dayworks query with date filters: .eq().gte().lte().order().limit()
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockLte = vi.fn().mockReturnValue({ order: mockOrder });
    const mockGte = vi.fn().mockReturnValue({ lte: mockLte });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ gte: mockGte }),
      }),
    });

    const res = await GET(makeRequest('?startDate=2026-04-01&endDate=2026-04-30'));
    expect(res.status).toBe(200);
    expect(mockGte).toHaveBeenCalledWith('start_date', '2026-04-01');
    expect(mockLte).toHaveBeenCalledWith('end_date', '2026-04-30');
  });
});
