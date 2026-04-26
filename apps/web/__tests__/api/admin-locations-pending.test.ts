import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as listGET } from '@/app/api/admin/locations/pending/route';
import { POST as cityPOST } from '@/app/api/admin/locations/pending/cities/[id]/route';
import { POST as portPOST } from '@/app/api/admin/locations/pending/ports/[id]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const fromMock = vi.fn();
const serviceClient = { from: fromMock };

function adminOk() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', is_admin: true },
      supabase: serviceClient,
      serviceClient,
    },
  };
}

function adminFail() {
  return {
    ok: false,
    response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  };
}

function chain<T>(returnValue: T | (() => T)) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.delete = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.is = vi.fn().mockReturnValue(builder);
  builder.in = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: typeof returnValue === 'function' ? (returnValue as () => T)() : returnValue, error: null }),
  );
  builder.single = vi.fn(() =>
    Promise.resolve({ data: typeof returnValue === 'function' ? (returnValue as () => T)() : returnValue, error: null }),
  );
  builder.then = vi.fn();
  return builder;
}

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const TARGET_UUID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/locations/pending', () => {
  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminFail());
    const res = await listGET();
    expect(res.status).toBe(403);
  });

  it('returns separated city + port lists', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());

    const cityBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi
        .fn()
        .mockResolvedValue({
          data: [
            {
              id: 'c1',
              name: 'Hidden Bay',
              region_id: 'r1',
              created_at: '2026-04-26T12:00:00Z',
              submitted_by: 'u1',
              regions: { id: 'r1', name: 'France', country_code: 'FR' },
            },
          ],
          error: null,
        }),
    };
    const portBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi
        .fn()
        .mockResolvedValue({
          data: [
            {
              id: 'p1',
              name: 'Tiny Marina',
              city_id: 'c1',
              created_at: '2026-04-26T12:00:00Z',
              submitted_by: 'u1',
              cities: {
                id: 'c1',
                name: 'Hidden Bay',
                region_id: 'r1',
                regions: { id: 'r1', name: 'France', country_code: 'FR' },
              },
            },
          ],
          error: null,
        }),
    };
    const profilesBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ person_id: 'u1', display_name: 'Alice' }],
        error: null,
      }),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'cities') return cityBuilder;
      if (table === 'ports') return portBuilder;
      if (table === 'profiles') return profilesBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const res = await listGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cities).toHaveLength(1);
    expect(body.cities[0]).toMatchObject({
      id: 'c1',
      name: 'Hidden Bay',
      region_name: 'France',
      country_code: 'FR',
      submitter_name: 'Alice',
    });
    expect(body.ports).toHaveLength(1);
    expect(body.ports[0]).toMatchObject({
      id: 'p1',
      name: 'Tiny Marina',
      city_name: 'Hidden Bay',
      region_name: 'France',
    });
  });
});

describe('POST /api/admin/locations/pending/cities/[id]', () => {
  function makeReq(body: unknown) {
    return new Request('http://localhost/api/admin/locations/pending/cities/x', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminFail());
    const res = await cityPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(403);
  });

  it('400 on invalid UUID', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await cityPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  it('400 on unknown action', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await cityPOST(makeReq({ action: 'destroy' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
  });

  it('409 when target city is not pending', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockReturnValue(chain({ id: VALID_UUID, source: 'curated', name: 'Antibes' }));
    const res = await cityPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(409);
  });

  it('approve flips source to curated', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    let call = 0;
    const updateSpy = vi.fn();

    fromMock.mockImplementation((table: string) => {
      call++;
      if (table !== 'cities') throw new Error(`unexpected ${table}`);
      if (call === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'Hidden Bay' });
      }
      // update path
      return {
        update: vi.fn((payload) => {
          updateSpy(payload);
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };
    });

    const res = await cityPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ source: 'curated' });
  });

  it('approve accepts a name override', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    let call = 0;
    const updateSpy = vi.fn();

    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'hidden bay' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpy(payload);
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
      };
    });

    const res = await cityPOST(makeReq({ action: 'approve', name: 'Hidden Bay' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ source: 'curated', name: 'Hidden Bay' });
  });

  it('hide stamps hidden_at', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    let call = 0;
    const updateSpy = vi.fn();

    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'Hidden Bay' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpy(payload);
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
      };
    });

    const res = await cityPOST(makeReq({ action: 'hide' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect((updateSpy.mock.calls[0][0] as { hidden_at: string }).hidden_at).toMatch(
      /\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('merge requires mergeToId', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockReturnValueOnce(chain({ id: VALID_UUID, source: 'pending', name: 'Hidden Bay' }));
    const res = await cityPOST(makeReq({ action: 'merge' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
  });

  it('merge re-points FK ripples then deletes the pending row', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const rippleUpdates: Array<{ table: string; column: string; value: unknown }> = [];
    let deletedFromCities = false;

    fromMock.mockImplementation((table: string) => {
      // First call (cities lookup for pending row)
      if (table === 'cities' && fromMock.mock.calls.length === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'Hidden Bay' });
      }
      // Second call (cities lookup for merge target)
      if (table === 'cities' && fromMock.mock.calls.length === 2) {
        return chain({ id: TARGET_UUID, source: 'curated' });
      }
      // FK ripple update
      if (
        table === 'ports' ||
        table === 'availability_windows' ||
        table === 'profiles' ||
        table === 'agent_placement_cities'
      ) {
        return {
          update: vi.fn((payload) => {
            const column = Object.keys(payload)[0];
            rippleUpdates.push({ table, column, value: payload[column] });
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }),
        };
      }
      // Final cities delete
      if (table === 'cities') {
        deletedFromCities = true;
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await cityPOST(makeReq({ action: 'merge', mergeToId: TARGET_UUID }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(rippleUpdates.map((u) => u.table)).toEqual([
      'ports',
      'availability_windows',
      'profiles',
      'agent_placement_cities',
    ]);
    expect(rippleUpdates.every((u) => u.value === TARGET_UUID)).toBe(true);
    expect(deletedFromCities).toBe(true);
  });
});

describe('POST /api/admin/locations/pending/ports/[id]', () => {
  function makeReq(body: unknown) {
    return new Request('http://localhost/api/admin/locations/pending/ports/x', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('approve flips source to curated', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpy = vi.fn();
    let call = 0;

    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'Tiny Marina' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpy(payload);
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
      };
    });

    const res = await portPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ source: 'curated' });
  });

  it('merge re-points six FK columns', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const rippleTables: string[] = [];
    let deletedFromPorts = false;

    fromMock.mockImplementation((table: string) => {
      if (table === 'ports' && fromMock.mock.calls.length === 1) {
        return chain({ id: VALID_UUID, source: 'pending', name: 'Tiny Marina' });
      }
      if (table === 'ports' && fromMock.mock.calls.length === 2) {
        return chain({ id: TARGET_UUID, source: 'curated' });
      }
      if (
        ['profiles', 'dayworks', 'daywork_templates', 'availability_windows', 'permanent_postings', 'permanent_templates'].includes(
          table,
        )
      ) {
        rippleTables.push(table);
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'ports') {
        deletedFromPorts = true;
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await portPOST(makeReq({ action: 'merge', mergeToId: TARGET_UUID }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(rippleTables).toEqual([
      'profiles',
      'dayworks',
      'daywork_templates',
      'availability_windows',
      'permanent_postings',
      'permanent_templates',
    ]);
    expect(deletedFromPorts).toBe(true);
  });
});
