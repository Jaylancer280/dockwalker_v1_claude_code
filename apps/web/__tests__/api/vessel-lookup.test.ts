import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/vessels/lookup/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-auth-session', () => ({
  requireAuthSession: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
      ...overrides,
    },
  };
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
    const vessels = [
      {
        id: 'v1',
        name: 'Alpha',
        vessel_type: 'motor',
        loa_meters: 40,
        imo_number: '1234567',
        source: 'curated',
        hidden_at: null,
        owner_person_id: 'u-other',
      },
      {
        id: 'v2',
        name: 'Beta',
        vessel_type: 'sail',
        loa_meters: 30,
        imo_number: '1234890',
        source: 'curated',
        hidden_at: null,
        owner_person_id: 'u-other',
      },
    ];
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: vessels, error: null }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=1234'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].name).toBe('Alpha');
    expect(body.results[0].imo_number).toBe('1234567');
    expect(body.results[1].name).toBe('Beta');
  });

  it('returns empty results array for partial with no matches', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9999'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it('returns at most 5 results for partial search and filters out other-user pending rows', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const mockLimit = vi.fn().mockResolvedValue({
      data: [
        // Two visible curated rows
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `v${i}`,
          name: `Vessel ${i}`,
          vessel_type: 'motor',
          loa_meters: 30 + i,
          imo_number: `5678${i}00`,
          source: 'curated',
          hidden_at: null,
          owner_person_id: 'u-other',
        })),
        // Other user's pending row — must be filtered out
        {
          id: 'pending-other',
          name: 'Other Pending',
          vessel_type: 'motor',
          loa_meters: 60,
          imo_number: '5678999',
          source: 'pending',
          hidden_at: null,
          owner_person_id: 'u-other',
        },
        // Other user's hidden row — must be filtered out
        {
          id: 'hidden-other',
          name: 'Hidden Other',
          vessel_type: 'motor',
          loa_meters: 60,
          imo_number: '5678888',
          source: 'curated',
          hidden_at: '2026-04-26T00:00:00Z',
          owner_person_id: 'u-other',
        },
      ],
      error: null,
    });
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: mockLimit,
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=5678'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only the 5 curated rows survive the filter; pending + hidden owned by
    // another user are excluded.
    expect(body.results).toHaveLength(5);
    expect(body.results.every((r: { id: string }) => r.id.startsWith('v'))).toBe(true);
  });

  it('partial search includes the caller\'s own pending submission', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'mine',
                name: 'My Pending Yacht',
                vessel_type: 'motor',
                loa_meters: 50,
                imo_number: '5678123',
                source: 'pending',
                hidden_at: null,
                owner_person_id: 'u1', // matches guardOk's user.id
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=5678'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].name).toBe('My Pending Yacht');
  });

  it('returns 500 on partial search DB error', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=1234'));
    expect(res.status).toBe(500);
  });

  it('returns found: false when vessel not in DB', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('returns found: true with vessel data when a curated vessel exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'v1',
              name: 'M/Y Test',
              vessel_type: 'motor',
              size_band_id: 'sb1',
              loa_meters: 45,
              source: 'curated',
              hidden_at: null,
              owner_person_id: 'u-other',
              vessel_size_bands: { label: '40-50m' },
            },
          ],
          error: null,
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.vessel.name).toBe('M/Y Test');
    expect(body.vessel.loa_meters).toBe(45);
    expect(body.vessel.size_band_label).toBe('40-50m');
    expect(body.vessel).not.toHaveProperty('imo_number');
  });

  it('exact lookup hides another user\'s pending vessel from the caller', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'pending-other',
              name: 'Pending Other',
              vessel_type: 'motor',
              size_band_id: 'sb1',
              loa_meters: 50,
              source: 'pending',
              hidden_at: null,
              owner_person_id: 'u-other',
              vessel_size_bands: null,
            },
          ],
          error: null,
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('exact lookup returns the caller\'s own pending vessel', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'mine',
              name: 'My Pending Yacht',
              vessel_type: 'motor',
              size_band_id: 'sb1',
              loa_meters: 50,
              source: 'pending',
              hidden_at: null,
              owner_person_id: 'u1',
              vessel_size_bands: null,
            },
          ],
          error: null,
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.vessel.name).toBe('My Pending Yacht');
  });

  it('exact lookup hides a hidden vessel from non-owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'hidden',
              name: 'Hidden Vessel',
              vessel_type: 'motor',
              size_band_id: 'sb1',
              loa_meters: 50,
              source: 'curated',
              hidden_at: '2026-04-26T00:00:00Z',
              owner_person_id: 'u-other',
              vessel_size_bands: null,
            },
          ],
          error: null,
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });
});
