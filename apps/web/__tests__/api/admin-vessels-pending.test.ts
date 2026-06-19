import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as listGET } from '@/app/api/admin/vessels/pending/route';
import { POST as actionPOST } from '@/app/api/admin/vessels/pending/[id]/route';

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

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const TARGET_UUID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

function chainSelect(rows: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
}

describe('GET /api/admin/vessels/pending', () => {
  it('403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminFail());
    const res = await listGET();
    expect(res.status).toBe(403);
  });

  it('returns pending vessels with submitter names attached', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());

    const vesselsRow = [
      {
        id: 'v1',
        imo_number: '1234567',
        name: 'Sea Wolf',
        vessel_type: 'motor',
        loa_meters: 60,
        flag_state_id: 'CYM',
        gross_tonnage: 250,
        beam_meters: 9.5,
        year_built: 2010,
        builder: 'Feadship',
        nda_flag: false,
        created_at: '2026-04-26T12:00:00Z',
        submitted_by: 'u1',
        vessel_size_bands: { label: '50–60m' },
        flag_states: { name: 'Cayman Islands' },
      },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === 'vessels') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: vesselsRow, error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ person_id: 'u1', display_name: 'Alice' }],
            error: null,
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await listGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vessels).toHaveLength(1);
    expect(body.vessels[0]).toMatchObject({
      id: 'v1',
      name: 'Sea Wolf',
      flag_state_name: 'Cayman Islands',
      size_band_label: '50–60m',
      submitter_name: 'Alice',
    });
  });
});

describe('POST /api/admin/vessels/pending/[id]', () => {
  function makeReq(body: unknown) {
    return new Request('http://localhost/api/admin/vessels/pending/x', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminFail());
    const res = await actionPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(403);
  });

  it('400 on invalid UUID', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await actionPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
  });

  it('400 on unknown action', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await actionPOST(makeReq({ action: 'destroy' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
  });

  it('409 when target vessel is already curated', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockReturnValue(
      chainSelect({ id: VALID_UUID, source: 'curated', name: 'Already Curated' }),
    );
    const res = await actionPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(409);
  });

  it('approve flips vessel + history rows from pending to curated', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpies: Record<string, ReturnType<typeof vi.fn>> = {};

    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      // First call: vessels lookup for pending row
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      const spy = vi.fn();
      updateSpies[table] = spy;
      return {
        update: vi.fn((payload) => {
          spy(payload);
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }),
      };
    });

    const res = await actionPOST(makeReq({ action: 'approve' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(updateSpies['vessels']).toHaveBeenCalledWith({ source: 'curated' });
    expect(updateSpies['vessel_names']).toHaveBeenCalledWith({ source: 'curated' });
    expect(updateSpies['vessel_flag_states']).toHaveBeenCalledWith({ source: 'curated' });
  });

  it('approve with name override updates both vessels.name and vessel_names', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpies: Record<string, unknown> = {};
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'sea wolf' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpies[table] = payload;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }),
      };
    });

    const res = await actionPOST(
      makeReq({ action: 'approve', name: 'Sea Wolf' }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);
    expect(updateSpies['vessels']).toEqual({ source: 'curated', name: 'Sea Wolf' });
    expect(updateSpies['vessel_names']).toEqual({ source: 'curated', name: 'Sea Wolf' });
  });

  it('approve enriches the vessel with admin-edited beam / GT / year / builder / flag / NDA', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const FLAG_UUID = '11111111-1111-1111-1111-111111111111';
    const updateSpies: Record<string, unknown> = {};
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpies[table] = payload;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }),
      };
    });

    const res = await actionPOST(
      makeReq({
        action: 'approve',
        flag_state_id: FLAG_UUID,
        year_built: 2018,
        builder: 'Lürssen',
        gross_tonnage: 1234.5,
        beam_meters: 12.4,
        nda_flag: true,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );
    expect(res.status).toBe(200);
    expect(updateSpies['vessels']).toMatchObject({
      source: 'curated',
      flag_state_id: FLAG_UUID,
      year_built: 2018,
      builder: 'Lürssen',
      gross_tonnage: 1234.5,
      beam_meters: 12.4,
      nda_flag: true,
    });
    // Name unchanged → vessel_names only flips source, no name in payload
    expect(updateSpies['vessel_names']).toEqual({ source: 'curated' });
  });

  it('approve rejects out-of-range year_built', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation((table: string) => {
      if (table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      return chainSelect(null);
    });
    const res = await actionPOST(makeReq({ action: 'approve', year_built: 1850 }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/year_built/i);
  });

  it('approve rejects negative gross_tonnage', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation((table: string) => {
      if (table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      return chainSelect(null);
    });
    const res = await actionPOST(makeReq({ action: 'approve', gross_tonnage: -10 }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/gross_tonnage/i);
  });

  it('hide stamps hidden_at = now()', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const updateSpy = vi.fn();
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'vessels') {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      return {
        update: vi.fn((payload) => {
          updateSpy(payload);
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
      };
    });
    const res = await actionPOST(makeReq({ action: 'hide' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect((updateSpy.mock.calls[0][0] as { hidden_at: string }).hidden_at).toMatch(
      /\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('merge requires mergeToId', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockReturnValueOnce(chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' }));
    const res = await actionPOST(makeReq({ action: 'merge' }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
  });

  it('merge re-points 3 FK ripples then deletes the pending vessel', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const rippleTables: string[] = [];
    let deleted = false;

    fromMock.mockImplementation((table: string) => {
      if (table === 'vessels' && fromMock.mock.calls.length === 1) {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      if (table === 'vessels' && fromMock.mock.calls.length === 2) {
        return chainSelect({ id: TARGET_UUID, source: 'curated' });
      }
      if (
        table === 'crew_experiences' ||
        table === 'dayworks' ||
        table === 'permanent_postings'
      ) {
        rippleTables.push(table);
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'vessels') {
        deleted = true;
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await actionPOST(makeReq({ action: 'merge', mergeToId: TARGET_UUID }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(200);
    expect(rippleTables).toEqual(['crew_experiences', 'dayworks', 'permanent_postings']);
    expect(deleted).toBe(true);
  });

  it('merge rejects a target that is itself pending', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    fromMock.mockImplementation((table: string) => {
      if (fromMock.mock.calls.length === 1) {
        return chainSelect({ id: VALID_UUID, source: 'pending', name: 'Sea Wolf' });
      }
      if (fromMock.mock.calls.length === 2) {
        return chainSelect({ id: TARGET_UUID, source: 'pending' });
      }
      throw new Error(`unexpected table ${table}`);
    });
    const res = await actionPOST(makeReq({ action: 'merge', mergeToId: TARGET_UUID }), {
      params: Promise.resolve({ id: VALID_UUID }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/curated or user-submitted/);
  });
});
