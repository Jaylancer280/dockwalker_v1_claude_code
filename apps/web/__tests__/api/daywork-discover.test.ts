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

/** Profiles chain for poster name resolution: .select().in() → resolves */
function makeProfilesChain(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data }),
    }),
  };
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
  filterProxy.lt = vi.fn().mockReturnValue(filterProxy);
  filterProxy.eq = vi.fn().mockReturnValue(filterProxy);
  filterProxy.contains = vi.fn().mockReturnValue(filterProxy);
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
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toBeDefined();
    expect(body.dayworks[0].vessels).toEqual({
      name: 'NDA Vessel',
      nda_flag: true,
      vessel_type: 'private',
      size_band_id: 'sb1',
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
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

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
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

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

  it('filters by certificationId using contains on required_certification_ids', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?certificationId=cert-123'));
    expect(res.status).toBe(200);
    expect(filterProxy.contains).toHaveBeenCalledWith('required_certification_ids', ['cert-123']);
  });

  it('certificationId=none filters for jobs with no cert requirements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?certificationId=none'));
    expect(res.status).toBe(200);
    expect(filterProxy.eq).toHaveBeenCalledWith('required_certification_ids', '{}');
    expect(filterProxy.contains).not.toHaveBeenCalled();
  });

  it('filters by experienceBracketId using eq on experience_bracket_id', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?experienceBracketId=eb-456'));
    expect(res.status).toBe(200);
    expect(filterProxy.eq).toHaveBeenCalledWith('experience_bracket_id', 'eb-456');
  });

  it('filters by sizeBandId via post-fetch vessel data', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const dayworks = [
      { id: 'd1', vessel_id: 'v1', poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
      { id: 'd2', vessel_id: 'v2', poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
    ];

    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(makeDayworksChain(dayworks).chain);
    // v1 has size band sb-match, v2 has sb-other
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v1', imo_number: null, name: 'Vessel A', vessel_type: 'motor', size_band_id: 'sb-match', size_band_label: '40-50m', nda_flag: false, owner_person_id: 'o1' }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v2', imo_number: null, name: 'Vessel B', vessel_type: 'sail', size_band_id: 'sb-other', size_band_label: '20-30m', nda_flag: false, owner_person_id: 'o2' }],
      error: null,
    });
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

    const res = await GET(makeRequest('?sizeBandId=sb-match'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toHaveLength(1);
    expect(body.dayworks[0].vessels.name).toBe('Vessel A');
  });

  it('applies combined filters (role + cert + bracket) together', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);

    const res = await GET(makeRequest('?roleId=r1&certificationId=cert-1&experienceBracketId=eb-1'));
    expect(res.status).toBe(200);
    // Role filter is applied via the initial .eq() chain, but cert and bracket go through filterProxy
    expect(filterProxy.contains).toHaveBeenCalledWith('required_certification_ids', ['cert-1']);
    expect(filterProxy.eq).toHaveBeenCalledWith('experience_bracket_id', 'eb-1');
  });

  it('sizeBandId filter excludes dayworks with no vessel (vessel_id null)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const dayworks = [
      { id: 'd1', vessel_id: null, poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
      { id: 'd2', vessel_id: 'v2', poster_person_id: 'other', start_date: '2026-04-01', end_date: '2026-04-05' },
    ];

    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(makeDayworksChain(dayworks).chain);
    // Only v2 has a vessel — and it matches the filter
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v2', imo_number: null, name: 'Vessel B', vessel_type: 'motor', size_band_id: 'sb-target', size_band_label: '40-50m', nda_flag: false, owner_person_id: 'o1' }],
      error: null,
    });
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

    const res = await GET(makeRequest('?sizeBandId=sb-target'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // d1 (no vessel) excluded, d2 (matching band) included
    expect(body.dayworks).toHaveLength(1);
    expect(body.dayworks[0].vessels.name).toBe('Vessel B');
  });

  it('applies all seven filters simultaneously', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const dayworks = [
      { id: 'd1', vessel_id: 'v1', poster_person_id: 'other', start_date: '2026-04-10', end_date: '2026-04-15' },
    ];

    const { chain, filterProxy } = makeDayworksChain(dayworks);
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    mockFromAuth.mockReturnValueOnce(chain);
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v1', imo_number: null, name: 'Test Vessel', vessel_type: 'motor', size_band_id: 'sb-1', size_band_label: '40-50m', nda_flag: false, owner_person_id: 'o1' }],
      error: null,
    });
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

    const res = await GET(
      makeRequest('?roleId=r1&portId=p1&startDate=2026-04-01&endDate=2026-04-30&certificationId=cert-1&experienceBracketId=eb-1&sizeBandId=sb-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toHaveLength(1);

    // DB-level filters
    expect(filterProxy.gte).toHaveBeenCalledWith('start_date', '2026-04-01');
    expect(filterProxy.lte).toHaveBeenCalledWith('end_date', '2026-04-30');
    expect(filterProxy.contains).toHaveBeenCalledWith('required_certification_ids', ['cert-1']);
    expect(filterProxy.eq).toHaveBeenCalledWith('experience_bracket_id', 'eb-1');
    // Post-fetch filter (sizeBandId) verified by the result including only matching vessel
    expect(body.dayworks[0].vessels.size_band_id).toBe('sb-1');
  });

  it('returns has_more and next_cursor with first batch', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));

    // Return fewer than 50 results → has_more should be false
    const daywork = {
      id: 'd1', job_number: 1, vessel_id: 'v1', start_date: '2026-04-01', end_date: '2026-04-05',
      working_days: 5, day_rate: 250, currency: 'EUR', meals: [], notes: null, status: 'active',
      created_at: '2026-03-15T12:00:00Z', poster_person_id: 'other',
      positions_available: 1, positions_filled: 0,
      yacht_roles: null, ports: null, experience_brackets: null, required_certification_ids: [],
    };
    const { chain } = makeDayworksChain([daywork]);
    mockFromAuth.mockReturnValueOnce(chain);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    mockFromAuth.mockReturnValueOnce(makeProfilesChain());

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
    expect(body.dayworks).toHaveLength(1);
  });

  it('applies cursor filter when cursor param provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));

    const { chain, filterProxy } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(chain);
    // No profiles mock needed — 0 results means no poster resolution

    const res = await GET(makeRequest('?cursor=2026-03-10T00:00:00Z'));
    expect(res.status).toBe(200);
    expect(filterProxy.lt).toHaveBeenCalledWith('created_at', '2026-03-10T00:00:00Z');
  });

  it('returns next_cursor as null when fewer than 50 results', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));

    const { chain } = makeDayworksChain([]);
    mockFromAuth.mockReturnValueOnce(chain);
    // No vessel or profile mocks needed — 0 results means no hydration queries

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
  });
});
