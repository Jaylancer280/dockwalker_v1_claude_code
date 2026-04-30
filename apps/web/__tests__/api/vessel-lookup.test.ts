import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/vessels/lookup/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-auth-session', () => ({
  requireAuthSession: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockServiceFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      supabase: { rpc: mockSupabaseRpc },
      serviceClient: { from: mockServiceFrom },
      ...overrides,
    },
  };
}

interface PublicVesselRow {
  id: string;
  imo_number: string | null;
  name: string;
  vessel_type: string;
  size_band_id: string | null;
  size_band_label: string | null;
  loa_meters: number | null;
  nda_flag: boolean;
  owner_person_id: string;
}

/**
 * Mock the IMO-scan step: serviceClient returns id+imo_number rows.
 * Mode 'partial' uses .ilike(...).limit(...). Mode 'exact' uses .eq(...).
 */
function mockImoScan(
  rows: Array<{ id: string; imo_number: string }>,
  mode: 'partial' | 'exact',
  error: { message: string } | null = null,
) {
  if (mode === 'partial') {
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: error ? null : rows, error }),
        }),
      }),
    });
  } else {
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: error ? null : rows, error }),
      }),
    });
  }
}

/**
 * Mock the RPC step: get_vessels_public_batch returns masked rows.
 * Pass an empty array to simulate the visibility filter (pending /
 * hidden / not-owned-not-engaged) excluding everything.
 */
function mockRpcBatch(rows: PublicVesselRow[], error: { message: string } | null = null) {
  mockSupabaseRpc.mockResolvedValueOnce({ data: error ? null : rows, error });
}

describe('GET /api/vessels/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=1234567'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when imo param is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await GET(new Request('http://localhost/api/vessels/lookup'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when imo is fewer than 4 digits', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('between 4 and 7 digits');
  });

  it('returns 400 when imo is more than 7 digits', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=12345678'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('between 4 and 7 digits');
  });

  it('returns partial results for 4-digit IMO prefix', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan(
      [
        { id: 'v1', imo_number: '1234567' },
        { id: 'v2', imo_number: '1234890' },
      ],
      'partial',
    );
    mockRpcBatch([
      {
        id: 'v1',
        imo_number: '1234567',
        name: 'Alpha',
        vessel_type: 'motor',
        size_band_id: null,
        size_band_label: null,
        loa_meters: 40,
        nda_flag: false,
        owner_person_id: 'u-other',
      },
      {
        id: 'v2',
        imo_number: '1234890',
        name: 'Beta',
        vessel_type: 'sail',
        size_band_id: null,
        size_band_label: null,
        loa_meters: 30,
        nda_flag: false,
        owner_person_id: 'u-other',
      },
    ]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=1234'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].name).toBe('Alpha');
    // Audit P1-S7: imo_number is stripped from partial-prefix responses to
    // avoid confirming exact IMO existence by prefix probing.
    expect(body.results[0].imo_number).toBeUndefined();
    expect(body.results[1].name).toBe('Beta');
    expect(body.results[1].imo_number).toBeUndefined();
  });

  it('returns empty results array for partial with no matches', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([], 'partial');

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9999'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it('returns at most 5 results for partial search and filters out other-user pending rows', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // IMO scan returns 7 candidate IDs: 5 curated + 1 pending-other + 1 hidden-other
    mockImoScan(
      [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `v${i}`,
          imo_number: `5678${i}00`,
        })),
        { id: 'pending-other', imo_number: '5678999' },
        { id: 'hidden-other', imo_number: '5678888' },
      ],
      'partial',
    );
    // RPC's WHERE clause excludes pending-other + hidden-other; only the
    // 5 curated rows survive the visibility filter.
    mockRpcBatch(
      Array.from({ length: 5 }, (_, i) => ({
        id: `v${i}`,
        imo_number: `5678${i}00`,
        name: `Vessel ${i}`,
        vessel_type: 'motor',
        size_band_id: null,
        size_band_label: null,
        loa_meters: 30 + i,
        nda_flag: false,
        owner_person_id: 'u-other',
      })),
    );

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=5678'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(5);
    expect(body.results.every((r: { id: string }) => r.id.startsWith('v'))).toBe(true);
  });

  it("partial search includes the caller's own pending submission", async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'mine', imo_number: '5678123' }], 'partial');
    // Owner branch in RPC includes pending row when caller IS the owner.
    mockRpcBatch([
      {
        id: 'mine',
        imo_number: '5678123',
        name: 'My Pending Yacht',
        vessel_type: 'motor',
        size_band_id: null,
        size_band_label: null,
        loa_meters: 50,
        nda_flag: false,
        owner_person_id: 'u1',
      },
    ]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=5678'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].name).toBe('My Pending Yacht');
  });

  it('returns 500 on partial search DB error', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([], 'partial', { message: 'DB error' });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=1234'));
    expect(res.status).toBe(500);
  });

  it('returns found: false when vessel not in DB', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([], 'exact');

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('returns found: true with vessel data when a curated vessel exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'v1', imo_number: '9876543' }], 'exact');
    mockRpcBatch([
      {
        id: 'v1',
        imo_number: '9876543',
        name: 'M/Y Test',
        vessel_type: 'motor',
        size_band_id: 'sb1',
        size_band_label: '40-50m',
        loa_meters: 45,
        nda_flag: false,
        owner_person_id: 'u-other',
      },
    ]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.vessel.name).toBe('M/Y Test');
    expect(body.vessel.loa_meters).toBe(45);
    expect(body.vessel.size_band_label).toBe('40-50m');
    expect(body.vessel).not.toHaveProperty('imo_number');
  });

  it("exact lookup hides another user's pending vessel from the caller", async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'pending-other', imo_number: '9876543' }], 'exact');
    // RPC's visibility filter excludes the row entirely → empty array
    mockRpcBatch([]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it("exact lookup returns the caller's own pending vessel", async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'mine', imo_number: '9876543' }], 'exact');
    mockRpcBatch([
      {
        id: 'mine',
        imo_number: '9876543',
        name: 'My Pending Yacht',
        vessel_type: 'motor',
        size_band_id: 'sb1',
        size_band_label: null,
        loa_meters: 50,
        nda_flag: false,
        owner_person_id: 'u1',
      },
    ]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.vessel.name).toBe('My Pending Yacht');
  });

  it('exact lookup hides a hidden vessel from non-owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'hidden', imo_number: '9876543' }], 'exact');
    // RPC excludes hidden_at row for non-owner non-engaged caller
    mockRpcBatch([]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('S-1: NDA vessel returns masked name and null IMO for non-engaged caller', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockImoScan([{ id: 'v-nda', imo_number: '7654321' }], 'exact');
    // RPC returns the row but with name masked and imo_number nulled
    mockRpcBatch([
      {
        id: 'v-nda',
        imo_number: null, // RPC null-mask for NDA
        name: 'NDA Vessel', // RPC string-mask for NDA
        vessel_type: 'motor',
        size_band_id: 'sb2',
        size_band_label: '60-80m',
        loa_meters: 70,
        nda_flag: true,
        owner_person_id: 'u-other',
      },
    ]);

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=7654321'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.vessel.name).toBe('NDA Vessel');
    expect(body.vessel).not.toHaveProperty('imo_number');
    // size_band still visible per existing precedent
    expect(body.vessel.size_band_label).toBe('60-80m');
  });
});
