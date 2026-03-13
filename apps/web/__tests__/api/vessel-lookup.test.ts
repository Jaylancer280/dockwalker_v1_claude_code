import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/vessels/lookup/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
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

  it('returns 400 when imo is not 7 digits', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=123'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('7 digits');
  });

  it('returns found: false when vessel not in DB', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost/api/vessels/lookup?imo=9876543'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('returns found: true with vessel data when vessel exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'v1',
                imo_number: '9876543',
                name: 'M/Y Test',
                vessel_type: 'charter',
                size_band_id: 'sb1',
                loa_meters: 45,
                vessel_size_bands: { label: '40-50m' },
              },
              error: null,
            }),
          }),
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
  });
});
