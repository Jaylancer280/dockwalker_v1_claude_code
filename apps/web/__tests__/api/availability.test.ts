import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/availability/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();
const mockFromService = vi.fn();

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
  return new Request('http://localhost/api/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(body: unknown): Request {
  return new Request('http://localhost/api/availability', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with windows and engagements', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const windows = [{ id: 'w1', date: '2026-04-01' }];
    const engagements = [{ id: 'e1', start_date: '2026-04-02' }];

    mockFromAuth
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: windows, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: engagements, error: null }),
          }),
        }),
      });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windows).toEqual(windows);
    expect(body.engagements).toEqual(engagements);
  });
});

describe('POST /api/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when not crew hat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_hat: 'employer' },
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when dates missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_hat: 'crew' },
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when end before start', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_hat: 'crew' },
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: '2026-04-10', endDate: '2026-04-01' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 when range exceeds 60 days', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_hat: 'crew' },
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: '2026-01-01', endDate: '2026-06-01' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('60 days');
  });

  it('returns 200 on successful set', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { current_hat: 'crew' },
          }),
        }),
      }),
    });
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.daysSet).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'AVAILABILITY.SET' }),
    );
  });
});

describe('DELETE /api/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(
      makeDeleteRequest({ dates: ['2026-04-01'] }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when dates not provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await DELETE(makeDeleteRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('dates array');
  });

  it('returns 200 on successful clear', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromService.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const res = await DELETE(
      makeDeleteRequest({ dates: ['2026-04-01', '2026-04-02'] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(2);
  });
});
