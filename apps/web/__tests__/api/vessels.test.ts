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
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
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

const validBody = {
  imoNumber: '1234567',
  name: 'MY Test Yacht',
  vesselType: 'private',
  sizeBandId: 'sb1',
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
    const vessels = [{ id: 'v1', name: 'Yacht One' }];
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

  it('returns 403 when crew hat tries to create vessel', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' } }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
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

    const res = await POST(
      makeRequest({ ...validBody, vesselType: 'cargo' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('private or charter');
  });

  it('returns 400 when size band ID is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain(null));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('size band ID');
  });

  it('returns 409 when IMO already registered', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain({ id: 'sb1' }));
    mockFromService.mockReturnValueOnce(
      makeSelectChain({ id: 'existing-vessel' }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 201 on successful creation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSelectChain({ id: 'sb1' }));
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
      }),
    );
  });
});
