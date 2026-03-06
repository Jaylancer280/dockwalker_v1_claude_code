import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/vessels/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFromService,
  })),
}));


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
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with vessels list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const vessels = [{ id: 'v1', name: 'Yacht One' }];
    mockFromAuth.mockReturnValueOnce(makeSelectChain(vessels));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vessels).toEqual(vessels);
  });

  it('returns empty array when no vessels', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
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
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 403 when crew hat tries to create vessel', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'crew' }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'employer' }),
    );

    const res = await POST(makeRequest({ imoNumber: '1234567' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 for invalid IMO number', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'employer' }),
    );

    const res = await POST(makeRequest({ ...validBody, imoNumber: '123' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('7 digits');
  });

  it('returns 400 for invalid vessel type', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'employer' }),
    );

    const res = await POST(
      makeRequest({ ...validBody, vesselType: 'cargo' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('private or charter');
  });

  it('returns 409 when IMO already registered', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'employer' }),
    );
    mockFromService.mockReturnValueOnce(
      makeSelectChain({ id: 'existing-vessel' }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('returns 201 on successful creation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeSelectChain({ current_hat: 'employer' }),
    );
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
