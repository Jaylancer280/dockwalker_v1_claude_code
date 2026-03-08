import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/availability/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

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

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
      ...overrides,
    },
  };
}

describe('GET /api/availability', () => {
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

  it('returns 409 when onboarding incomplete', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    });

    const res = await GET();
    expect(res.status).toBe(409);
  });

  it('returns 200 with windows and engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
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

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 403 when not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await POST(
      makeRequest({ startDate: '2026-04-01', endDate: '2026-04-05' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when dates missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when end before start', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ startDate: '2026-04-10', endDate: '2026-04-01' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 when range exceeds 60 days', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ startDate: '2026-01-01', endDate: '2026-06-01' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('60 days');
  });

  it('returns 200 on successful set', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await DELETE(
      makeDeleteRequest({ dates: ['2026-04-01'] }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when dates not provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await DELETE(makeDeleteRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('dates array');
  });

  it('returns 200 on successful clear', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await DELETE(
      makeDeleteRequest({ dates: ['2026-04-01', '2026-04-02'] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith(
      'clear_availability_dates',
      expect.objectContaining({
        p_person_id: 'u1',
        p_dates: ['2026-04-01', '2026-04-02'],
      }),
    );
  });

  it('returns 400 when a date is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await DELETE(
      makeDeleteRequest({ dates: ['not-a-date'] }),
    );
    expect(res.status).toBe(400);
  });
});
