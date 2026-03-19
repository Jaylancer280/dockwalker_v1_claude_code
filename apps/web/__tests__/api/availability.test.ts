import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/availability/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();
const mockFromService = vi.fn();

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
      serviceClient: { rpc: mockRpc, from: mockFromService },
      ...overrides,
    },
  };
}

/** Build a date string N days from today in YYYY-MM-DD format */
function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
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

  it('returns 200 with windows, engagements, city, and status available', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const windows = [{ id: 'w1', date: '2026-04-01', city_id: 'c1', not_available: false }];
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
            single: vi.fn().mockResolvedValue({
              data: { id: 'c1', name: 'Antibes', regions: { name: 'French Riviera' } },
              error: null,
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
    expect(body.status).toBe('available');
    expect(body.city).toEqual({
      id: 'c1',
      name: 'Antibes',
      region_name: 'French Riviera',
    });
  });

  it('returns status not_available when crew declared not available', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const windows = [{ id: 'w1', date: '2026-04-01', city_id: 'c1', not_available: true }];

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
            single: vi.fn().mockResolvedValue({
              data: { id: 'c1', name: 'Antibes', regions: { name: 'French Riviera' } },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('not_available');
    expect(body.windows).toEqual([]);
  });

  it('returns port data when windows have port_id', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const windows = [{ id: 'w1', date: '2026-04-01', city_id: 'c1', port_id: 'p1', not_available: false }];

    mockFromAuth
      // availability_windows
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: windows, error: null }),
            }),
          }),
        }),
      })
      // cities
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'c1', name: 'Antibes', regions: { name: 'French Riviera' } },
              error: null,
            }),
          }),
        }),
      })
      // active_engagements
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })
      // ports
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'p1', name: 'Port Vauban' },
              error: null,
            }),
          }),
        }),
      });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.port).toEqual({ id: 'p1', name: 'Port Vauban' });
  });

  it('returns status null when no availability set', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(null);
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
      makeRequest({ startDate: futureDate(1), endDate: futureDate(5), cityId: 'c1' }),
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
      makeRequest({ startDate: futureDate(1), endDate: futureDate(5), cityId: 'c1' }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 403 when not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(5), cityId: 'c1' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when dates missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ cityId: 'c1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when cityId missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ startDate: futureDate(1), endDate: futureDate(5) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cityId');
  });

  it('returns 400 when end before start', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ startDate: futureDate(5), endDate: futureDate(1), cityId: 'c1' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 when dates exceed 14-day window', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(20), cityId: 'c1' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('14 days');
  });

  it('returns 400 for past dates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ startDate: '2020-01-01', endDate: '2020-01-05', cityId: 'c1' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('past');
  });

  it('returns 400 when cityId not found in cities table', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(5), cityId: 'invalid-id' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid cityId');
  });

  it('returns 200 on successful set with cityId', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
        }),
      }),
    });
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(5), cityId: 'c1' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.daysSet).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'AVAILABILITY.SET',
        p_payload: expect.objectContaining({ city_id: 'c1' }),
      }),
    );
  });

  it('returns 200 on notAvailable with cityId (no dates needed)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
        }),
      }),
    });
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ notAvailable: true, cityId: 'c1' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notAvailable).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'AVAILABILITY.SET',
        p_payload: expect.objectContaining({
          city_id: 'c1',
          not_available: true,
        }),
      }),
    );
  });

  it('returns 200 on successful set with cityId and portId', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // portId validation: port exists and belongs to city
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'p1', city_id: 'c1' }, error: null }),
        }),
      }),
    });
    // cityId validation
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
        }),
      }),
    });
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(3), cityId: 'c1', portId: 'p1' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({ city_id: 'c1', port_id: 'p1' }),
      }),
    );
  });

  it('returns 400 when portId does not exist', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(3), cityId: 'c1', portId: 'invalid' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid portId');
  });

  it('returns 400 when portId belongs to different city', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'p1', city_id: 'c2' }, error: null }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ startDate: futureDate(1), endDate: futureDate(3), cityId: 'c1', portId: 'p1' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('does not belong');
  });

  it('returns 400 on notAvailable without cityId', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ notAvailable: true }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cityId');
  });

  it('returns 400 on notAvailable with invalid cityId', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ notAvailable: true, cityId: 'invalid-id' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid cityId');
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

  it('returns 200 on clearAll — appends AVAILABILITY.SET event via ledger', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Mock the last-city lookup
    mockFromService.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { city_id: 'city1' } }),
            }),
          }),
        }),
      }),
    });
    // Mock appendEvent (via serviceClient.rpc)
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await DELETE(makeDeleteRequest({ clearAll: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe('all');
    // Verify it went through the ledger, not direct delete
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'AVAILABILITY.SET',
        p_payload: expect.objectContaining({ not_available: true }),
      }),
    );
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
