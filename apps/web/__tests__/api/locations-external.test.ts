import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as searchExternalGET } from '@/app/api/locations/search-external/route';
import { POST as canonicalizePOST } from '@/app/api/locations/canonicalize/route';

const mockRequireAuthSession = vi.fn();
vi.mock('@/lib/auth/require-auth-session', () => ({
  requireAuthSession: () => mockRequireAuthSession(),
}));

interface QueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

const fromMock = vi.fn();
const fetchMock = vi.fn();

function authOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      supabase: {},
      serviceClient: { from: fromMock },
    },
  };
}

function authFail() {
  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}

function buildBuilder(): QueryBuilder {
  const builder = {} as QueryBuilder;
  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.is = vi.fn().mockReturnValue(builder);
  builder.ilike = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn();
  builder.maybeSingle = vi.fn();
  return builder;
}

// Monotonically advance the fake clock between tests so the route's
// module-level `lastRequestAt` is always outside the 1-second cooldown
// window when a new test starts (no leakage from prior tests).
const TEST_BASE = new Date(2026, 0, 1, 12, 0, 0).getTime();
let testTimeCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  testTimeCounter += 60_000;
  vi.useFakeTimers();
  vi.setSystemTime(TEST_BASE + testTimeCounter);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GET /api/locations/search-external', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuthSession.mockResolvedValue(authFail());
    const res = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=foo'),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty results when q is under 3 chars', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const res = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=ab'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes Nominatim hits and filters out unsupported place types', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          osm_type: 'relation',
          osm_id: 12345,
          lat: '36.6914',
          lon: '28.9456',
          display_name: 'Göcek, Muğla, Turkey',
          class: 'place',
          type: 'town',
          name: 'Göcek',
          address: { country_code: 'tr', country: 'Turkey' },
        },
        {
          osm_type: 'way',
          osm_id: 99,
          lat: '36.69',
          lon: '28.94',
          display_name: 'Some restaurant',
          class: 'amenity',
          type: 'restaurant', // filtered out
        },
        {
          osm_type: 'node',
          osm_id: 88,
          lat: '36.5',
          lon: '28.5',
          display_name: 'D-Marin Göcek, Turkey',
          class: 'leisure',
          type: 'marina',
          name: 'D-Marin Göcek',
          address: { country_code: 'tr', country: 'Turkey' },
        },
      ],
    });

    const res = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=gocek'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual({
      osm_id: 12345,
      osm_type: 'relation',
      name: 'Göcek',
      country_code: 'TR',
      country_name: 'Turkey',
      latitude: 36.6914,
      longitude: 28.9456,
      place_type: 'town',
      display_name: 'Göcek, Muğla, Turkey',
    });
    expect(body.results[1].place_type).toBe('marina');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[urlArg, init]] = fetchMock.mock.calls;
    expect(String(urlArg)).toContain('q=gocek');
    expect((init as { headers: Record<string, string> }).headers['User-Agent']).toContain(
      'dockwalker.io',
    );
  });

  it('swallows fetch errors to an empty result set', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=remote'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  it('rate-limits a second call inside the cooldown window', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const res1 = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=first'),
    );
    expect(res1.status).toBe(200);

    // Without advancing the system clock, the second call should be
    // rate-limited and skip the network entirely.
    const res2 = await searchExternalGET(
      new Request('http://localhost/api/locations/search-external?q=second'),
    );
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/locations/canonicalize', () => {
  function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/locations/canonicalize', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('401 when unauthenticated', async () => {
    mockRequireAuthSession.mockResolvedValue(authFail());
    const res = await canonicalizePOST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('400 on invalid body shape', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const res = await canonicalizePOST(
      makeRequest({ osm_id: 'not-a-number', osm_type: 'relation', name: 'X' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns existing cityId when matched by osm_place_id', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const regionBuilder = buildBuilder();
    regionBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'region-existing' },
      error: null,
    });
    const cityByOsmBuilder = buildBuilder();
    cityByOsmBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'city-existing' },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') return regionBuilder;
      if (table === 'cities') return cityByOsmBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const res = await canonicalizePOST(
      makeRequest({
        osm_id: 12345,
        osm_type: 'relation',
        name: 'Göcek',
        country_code: 'TR',
        country_name: 'Turkey',
        latitude: 36.69,
        longitude: 28.94,
        place_type: 'town',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cityId).toBe('city-existing');
    expect(cityByOsmBuilder.eq).toHaveBeenCalledWith('osm_place_id', 'R12345');
  });

  it('falls back to (region, name) match when osm_place_id misses', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const regionBuilder = buildBuilder();
    regionBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'region-fr' },
      error: null,
    });

    let cityCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') return regionBuilder;
      if (table === 'cities') {
        cityCallCount++;
        const b = buildBuilder();
        if (cityCallCount === 1) {
          // osm_place_id lookup misses
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else if (cityCallCount === 2) {
          // (region_id, name) lookup hits
          b.maybeSingle.mockResolvedValue({ data: { id: 'city-byname' }, error: null });
        }
        return b;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await canonicalizePOST(
      makeRequest({
        osm_id: 99,
        osm_type: 'node',
        name: 'Antibes',
        country_code: 'FR',
        country_name: 'France',
        latitude: 43.58,
        longitude: 7.12,
        place_type: 'city',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cityId).toBe('city-byname');
    expect(cityCallCount).toBe(2);
  });

  it('creates a new region and city when neither exists', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());

    let regionCallCount = 0;
    let cityCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') {
        regionCallCount++;
        const b = buildBuilder();
        if (regionCallCount === 1) {
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else if (regionCallCount === 2) {
          b.single.mockResolvedValue({ data: { id: 'region-new' }, error: null });
        }
        return b;
      }
      if (table === 'cities') {
        cityCallCount++;
        const b = buildBuilder();
        if (cityCallCount === 1 || cityCallCount === 2) {
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else if (cityCallCount === 3) {
          b.single.mockResolvedValue({ data: { id: 'city-new' }, error: null });
        }
        return b;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await canonicalizePOST(
      makeRequest({
        osm_id: 7777,
        osm_type: 'way',
        name: 'New Marina',
        country_code: 'PT',
        country_name: 'Portugal',
        latitude: 38.5,
        longitude: -9.0,
        place_type: 'marina',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cityId).toBe('city-new');
    expect(regionCallCount).toBe(2);
    expect(cityCallCount).toBe(3);
  });

  it('falls back to "Unknown" region when no country_code is supplied', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const unknownBuilder = buildBuilder();
    unknownBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'region-unknown' },
      error: null,
    });
    const cityByOsmBuilder = buildBuilder();
    cityByOsmBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'city-unknown' },
      error: null,
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') return unknownBuilder;
      if (table === 'cities') return cityByOsmBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const res = await canonicalizePOST(
      makeRequest({
        osm_id: 1,
        osm_type: 'relation',
        name: 'Mystery Bay',
        latitude: 0,
        longitude: 0,
        place_type: 'harbour',
      }),
    );

    expect(res.status).toBe(200);
    expect(unknownBuilder.eq).toHaveBeenCalledWith('name', 'Unknown');
    expect(unknownBuilder.is).toHaveBeenCalledWith('country_code', null);
  });
});
