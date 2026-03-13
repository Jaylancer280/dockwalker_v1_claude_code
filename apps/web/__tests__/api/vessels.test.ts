import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/vessels/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/vessels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSelectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
        single: vi.fn().mockResolvedValue({ data, error }),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
          maybeSingle: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
      order: vi.fn().mockResolvedValue({ data, error }),
    }),
  };
}

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc, from: mockFromService },
      ...overrides,
    },
  };
}

const sizeBands = [
  { id: 'sb1', min_meters: 24, max_meters: 30 },
  { id: 'sb2', min_meters: 30, max_meters: 40 },
  { id: 'sb3', min_meters: 40, max_meters: 50 },
  { id: 'sb4', min_meters: 80, max_meters: null },
];

const validBody = {
  imoNumber: '1234567',
  name: 'MY Test Yacht',
  vesselType: 'private',
  loaMeters: 35,
  ndaFlag: false,
};

describe('GET /api/vessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with vessels list', async () => {
    const vessels = [{ id: 'v1', name: 'Yacht One', loa_meters: 45 }];
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain(vessels));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vessels).toEqual(vessels);
  });

  it('returns empty array when no vessels', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain(null));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vessels).toEqual([]);
  });
});

describe('POST /api/vessels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest(validBody));
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

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('allows crew hat to create vessel for experience entries', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' } }),
    );
    mockFromAuth.mockReturnValueOnce(makeSelectChain(sizeBands));
    mockFromService.mockReturnValueOnce(makeSelectChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    // Crew vessels should always have nda_flag: false
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({ nda_flag: false }),
      }),
    );
  });

  it('returns 400 when required fields missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ imoNumber: '1234567' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 for invalid IMO number', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, imoNumber: '123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('7 digits');
  });

  it('returns 400 for invalid vessel type', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, vesselType: 'cargo' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('private or charter');
  });

  it('returns 400 for invalid LOA', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, loaMeters: -5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('positive number');
  });

  it('returns 400 when LOA below minimum size band', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Size bands lookup
    mockFromAuth.mockReturnValueOnce(makeSelectChain(sizeBands));

    const res = await POST(makeRequest({ ...validBody, loaMeters: 10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('does not match');
  });

  it('returns 409 when IMO already registered', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Size bands lookup
    mockFromAuth.mockReturnValueOnce(makeSelectChain(sizeBands));
    // IMO uniqueness check
    mockFromService.mockReturnValueOnce(makeSelectChain({ id: 'existing-vessel' }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 201 on successful creation with auto-derived size band', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Size bands lookup — LOA 35 matches sb2 (30-40m)
    mockFromAuth.mockReturnValueOnce(makeSelectChain(sizeBands));
    // IMO uniqueness check
    mockFromService.mockReturnValueOnce(makeSelectChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'VESSEL.CREATED',
        p_payload: expect.objectContaining({
          size_band_id: 'sb2',
          loa_meters: 35,
        }),
      }),
    );
  });

  it('auto-derives correct band for 80m+ vessels', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain(sizeBands));
    mockFromService.mockReturnValueOnce(makeSelectChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ ...validBody, loaMeters: 95 }));
    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          size_band_id: 'sb4',
          loa_meters: 95,
        }),
      }),
    );
  });
});
