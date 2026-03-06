import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));


function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  };
}

const validBody = {
  vesselId: 'v1',
  roleId: 'r1',
  locationPortId: 'p1',
  startDate: '2026-04-01',
  endDate: '2026-04-05',
  workingDays: 5,
};

describe('POST /api/daywork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 403 when crew hat tries to post', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'crew' }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await POST(makeRequest({ vesselId: 'v1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 for invalid date format', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await POST(
      makeRequest({ ...validBody, startDate: 'not-a-date' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when end date before start date', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await POST(
      makeRequest({
        ...validBody,
        startDate: '2026-04-10',
        endDate: '2026-04-01',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 when working days out of range', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await POST(
      makeRequest({ ...validBody, workingDays: 20 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('between 1 and 14');
  });

  it('returns 400 for invalid meals', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ current_hat: 'employer' }));

    const res = await POST(
      makeRequest({ ...validBody, meals: ['snack'] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid meal');
  });

  it('returns 404 when vessel not owned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(makeChain({ current_hat: 'employer' }))
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 201 on successful posting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(makeChain({ current_hat: 'employer' }))
      .mockReturnValueOnce(makeChain({ id: 'v1' }));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'DAYWORK.POSTED' }),
    );
  });
});
