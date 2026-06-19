import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as requestPOST } from '@/app/api/locations/request/route';
import { GET as regionsGET } from '@/app/api/locations/regions/route';

const mockRequireAuthSession = vi.fn();
vi.mock('@/lib/auth/require-auth-session', () => ({
  requireAuthSession: () => mockRequireAuthSession(),
}));

interface QueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

const fromMock = vi.fn();
const supabaseMock = { from: fromMock };

function authOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      supabase: supabaseMock,
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
  builder.ilike = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn();
  builder.maybeSingle = vi.fn();
  builder.then = vi.fn();
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/locations/request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/locations/request', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuthSession.mockResolvedValue(authFail());
    const res = await requestPOST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('400 when country_code missing', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const res = await requestPOST(makeRequest({ city_name: 'Anywhere' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/country_code/);
  });

  it('400 when country_code is not a 2-letter code', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const res = await requestPOST(
      makeRequest({ country_code: 'FRA', city_name: 'Paris' }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when city_name missing', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const res = await requestPOST(makeRequest({ country_code: 'FR' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/city_name/);
  });

  it('inserts a pending city under existing region and returns its id', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    let regionCalls = 0;
    let cityCalls = 0;
    const insertSpy = vi.fn();

    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') {
        regionCalls++;
        const b = buildBuilder();
        b.maybeSingle.mockResolvedValue({ data: { id: 'region-fr' }, error: null });
        return b;
      }
      if (table === 'cities') {
        cityCalls++;
        const b = buildBuilder();
        if (cityCalls === 1) {
          // Lookup misses
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else {
          // Insert path — capture the payload
          b.insert = vi.fn((payload) => {
            insertSpy(payload);
            return b;
          });
          b.single.mockResolvedValue({ data: { id: 'city-pending' }, error: null });
        }
        return b;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await requestPOST(
      makeRequest({
        country_code: 'fr',
        country_name: 'France',
        city_name: 'Hidden Bay',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ cityId: 'city-pending' });
    expect(regionCalls).toBe(1);
    expect(cityCalls).toBe(2);
    expect(insertSpy).toHaveBeenCalledWith({
      region_id: 'region-fr',
      name: 'Hidden Bay',
      source: 'pending',
      sort_order: 999,
      submitted_by: 'u1',
    });
  });

  it('creates region + city + port when all are new', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());

    let regionCalls = 0;
    let cityCalls = 0;
    let portCalls = 0;
    const insertedTables: Array<{ table: string; payload: unknown }> = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'regions') {
        regionCalls++;
        const b = buildBuilder();
        if (regionCalls === 1) {
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else {
          b.insert = vi.fn((payload) => {
            insertedTables.push({ table: 'regions', payload });
            return b;
          });
          b.single.mockResolvedValue({ data: { id: 'region-new' }, error: null });
        }
        return b;
      }
      if (table === 'cities') {
        cityCalls++;
        const b = buildBuilder();
        if (cityCalls === 1) {
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else {
          b.insert = vi.fn((payload) => {
            insertedTables.push({ table: 'cities', payload });
            return b;
          });
          b.single.mockResolvedValue({ data: { id: 'city-new' }, error: null });
        }
        return b;
      }
      if (table === 'ports') {
        portCalls++;
        const b = buildBuilder();
        if (portCalls === 1) {
          b.maybeSingle.mockResolvedValue({ data: null, error: null });
        } else {
          b.insert = vi.fn((payload) => {
            insertedTables.push({ table: 'ports', payload });
            return b;
          });
          b.single.mockResolvedValue({ data: { id: 'port-new' }, error: null });
        }
        return b;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await requestPOST(
      makeRequest({
        country_code: 'PT',
        country_name: 'Portugal',
        city_name: 'Sleepy Town',
        port_name: 'Tiny Marina',
        notes: 'A nice spot',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ cityId: 'city-new', portId: 'port-new' });
    expect(insertedTables.map((x) => x.table)).toEqual(['regions', 'cities', 'ports']);
    expect(insertedTables[1].payload).toMatchObject({
      source: 'pending',
      name: 'Sleepy Town',
    });
    expect(insertedTables[2].payload).toMatchObject({
      source: 'pending',
      name: 'Tiny Marina',
      city_id: 'city-new',
    });
  });

  it('reuses an existing city even if its source is curated', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    fromMock.mockImplementation((table: string) => {
      const b = buildBuilder();
      if (table === 'regions') {
        b.maybeSingle.mockResolvedValue({ data: { id: 'region-existing' }, error: null });
      } else if (table === 'cities') {
        b.maybeSingle.mockResolvedValue({ data: { id: 'city-existing' }, error: null });
      } else {
        throw new Error(`unexpected table ${table}`);
      }
      return b;
    });

    const res = await requestPOST(
      makeRequest({
        country_code: 'FR',
        city_name: 'Antibes',
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ cityId: 'city-existing' });
  });
});

describe('GET /api/locations/regions', () => {
  it('401 when unauthenticated', async () => {
    mockRequireAuthSession.mockResolvedValue(authFail());
    const res = await regionsGET();
    expect(res.status).toBe(401);
  });

  it('returns regions sorted by sort_order then name', async () => {
    mockRequireAuthSession.mockResolvedValue(authOk());
    const orderSpy1 = vi.fn();
    const orderSpy2 = vi.fn();
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn(function (this: unknown, ...args: unknown[]) {
        if (orderSpy1.mock.calls.length === 0) {
          orderSpy1(...args);
          return this;
        }
        orderSpy2(...args);
        return Promise.resolve({
          data: [
            { id: 'r1', name: 'Aaa', country_code: 'AA' },
            { id: 'r2', name: 'Bbb', country_code: 'BB' },
          ],
          error: null,
        });
      }),
    };
    fromMock.mockReturnValue(builder);

    const res = await regionsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.regions).toHaveLength(2);
    expect(orderSpy1).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(orderSpy2).toHaveBeenCalledWith('name', { ascending: true });
  });
});
