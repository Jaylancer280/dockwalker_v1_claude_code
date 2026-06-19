import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/admin/vessels/[id]/route';

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

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const FLAG_UUID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

function chainSelect(rows: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
}

function makeReq(body: unknown) {
  return new Request('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/vessels/[id]', () => {
  it('refuses pending vessels — must use the pending-queue route instead', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation(() =>
      chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' }),
    );
    const res = await PATCH(makeReq({ name: 'Fixed Name' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/pending/i);
  });

  it('rejects 400 when no fields provided', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation(() =>
      chainSelect({ id: VALID_UUID, source: 'curated', name: 'Sea Wolf' }),
    );
    const res = await PATCH(makeReq({}), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no fields/i);
  });

  it('rejects 404 when vessel does not exist', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation(() => chainSelect(null));
    const res = await PATCH(makeReq({ name: 'Anything' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects out-of-range year_built', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation(() =>
      chainSelect({ id: VALID_UUID, source: 'curated', name: 'Sea Wolf' }),
    );
    const res = await PATCH(makeReq({ year_built: 1800 }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/year_built/i);
  });

  it('rejects negative gross_tonnage', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation(() =>
      chainSelect({ id: VALID_UUID, source: 'curated', name: 'Sea Wolf' }),
    );
    const res = await PATCH(makeReq({ gross_tonnage: -5 }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/gross_tonnage/i);
  });

  it('happy path — applies admin enrichment edits to a curated vessel', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpies: Record<string, unknown> = {};
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'curated', name: 'Sea Wolf' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpies[table] = payload;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }),
      };
    });

    const res = await PATCH(
      makeReq({
        name: 'Sea Wolf II',
        flag_state_id: FLAG_UUID,
        year_built: 2020,
        builder: 'Lürssen',
        gross_tonnage: 999.9,
        beam_meters: 11.5,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);
    expect(updateSpies['vessels']).toMatchObject({
      name: 'Sea Wolf II',
      flag_state_id: FLAG_UUID,
      year_built: 2020,
      builder: 'Lürssen',
      gross_tonnage: 999.9,
      beam_meters: 11.5,
    });
    // Source is NOT in the payload — admin edit doesn't flip source
    expect(updateSpies['vessels']).not.toHaveProperty('source');
    // Name change ripples to the vessel_names timeline row
    expect(updateSpies['vessel_names']).toEqual({ name: 'Sea Wolf II' });
  });

  it('skips vessel_names update when name is unchanged', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpies: Record<string, unknown> = {};
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'curated', name: 'Sea Wolf' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpies[table] = payload;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }),
      };
    });

    await PATCH(makeReq({ year_built: 2015 }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(updateSpies['vessels']).toEqual({ year_built: 2015 });
    expect(updateSpies['vessel_names']).toBeUndefined();
  });
});
