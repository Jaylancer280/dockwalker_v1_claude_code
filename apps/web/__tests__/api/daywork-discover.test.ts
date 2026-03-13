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

/** Applications query chain: .select().eq().in() */
function makeAppsChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

/**
 * Dayworks query chain: .select().eq('status').neq('poster')[.not()][.eq()][.gte()][.lte()].order().limit()
 * Returns mockOrder so callers can assert on sort params.
 */
function makeDayworksChain(data: unknown[], hasExcludedIds = false) {
  const mockLimit = vi.fn().mockResolvedValue({ data, error: null });
  const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });

  // Terminal filters — any of gte/lte/eq/order can be called in any combination.
  // Build a self-returning proxy that eventually exposes order().limit().
  const filterProxy: Record<string, ReturnType<typeof vi.fn>> = {};
  filterProxy.gte = vi.fn().mockReturnValue(filterProxy);
  filterProxy.lte = vi.fn().mockReturnValue(filterProxy);
  filterProxy.eq = vi.fn().mockReturnValue(filterProxy);
  filterProxy.order = mockOrder;

  // .neq() or .not() before optional filters
  const neqResult = hasExcludedIds
    ? { not: vi.fn().mockReturnValue(filterProxy) }
    : filterProxy;

  const chain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue(neqResult),
      }),
    }),
  };

  return { chain, mockOrder, mockLimit, filterProxy };
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

    const dayworks = [
      {
        id: 'd1',
        vessel_id: 'v1',
        poster_person_id: 'other',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      },
    ];

    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(makeDayworksChain(dayworks).chain);
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

    const dayworks = [
      { id: 'd1', vessel_id: null, poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
    ];

    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(makeDayworksChain(dayworks).chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toHaveLength(1);
  });

  it('does not accept sort parameter', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, mockOrder } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?sort=proximity'));
    expect(res.status).toBe(200);
    // Only recency ordering is used regardless of sort param
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('passes date filters to query', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?startDate=2026-04-01&endDate=2026-04-30'));
    expect(res.status).toBe(200);
    expect(filterProxy.gte).toHaveBeenCalledWith('start_date', '2026-04-01');
    expect(filterProxy.lte).toHaveBeenCalledWith('end_date', '2026-04-30');
  });

  it('excludes interacted dayworks at the DB level via not-in filter', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Crew has interacted with d2 and d3
    mockFromAuth.mockReturnValueOnce(
      makeAppsChain([{ daywork_id: 'd2' }, { daywork_id: 'd3' }]),
    );

    const dayworks = [
      { id: 'd1', vessel_id: null, poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
    ];
    const { chain } = makeDayworksChain(dayworks, true);
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toHaveLength(1);

    // Verify the .not() filter was called with the excluded IDs
    const selectCall = chain.select();
    const eqCall = selectCall.eq();
    const neqCall = eqCall.neq();
    expect(neqCall.not).toHaveBeenCalledWith('id', 'in', '(d2,d3)');
  });
});
