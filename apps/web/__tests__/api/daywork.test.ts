import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSingleChain(data: unknown) {
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

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
      ...overrides,
    },
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

const validBody = {
  vesselId: 'v1',
  roleId: 'r1',
  locationPortId: 'p1',
  startDate: futureDate(1),
  endDate: futureDate(5),
  workingDays: 5,
  dayRate: '250',
  currency: 'EUR',
};

function setupFkMocks(overrides: { vessel?: unknown; role?: unknown; port?: unknown } = {}) {
  const vessel = overrides.vessel !== undefined ? overrides.vessel : { id: 'v1' };
  const role = overrides.role !== undefined ? overrides.role : { id: 'r1' };
  const port = overrides.port !== undefined ? overrides.port : { id: 'p1' };

  mockFromAuth
    .mockReturnValueOnce(makeSingleChain(vessel))
    .mockReturnValueOnce(makeSingleChain(role))
    .mockReturnValueOnce(makeSingleChain(port));
}

describe('POST /api/daywork', () => {
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

  it('returns 403 when crew hat tries to post', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' } }),
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ vesselId: 'v1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when dayRate is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const { dayRate: _dayRate, ...bodyWithoutDayRate } = validBody;
    const res = await POST(makeRequest(bodyWithoutDayRate));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when dayRate is empty string', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, dayRate: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns 400 when dayRate is zero or negative', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, dayRate: '0' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('positive number');
  });

  it('returns 400 when dayRate is not a number', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, dayRate: 'abc' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('positive number');
  });

  it('returns 400 for invalid currency', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeRequest({ ...validBody, currency: 'JPY' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Currency');
  });

  it('defaults to EUR when currency not provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const { currency: _currency, ...bodyWithoutCurrency } = validBody;
    const res = await POST(makeRequest(bodyWithoutCurrency));
    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({ currency: 'EUR' }),
      }),
    );
  });

  it('accepts all valid currencies', async () => {
    for (const cur of ['EUR', 'USD', 'GBP', 'AED']) {
      vi.clearAllMocks();
      mockRequireDomainUser.mockResolvedValue(guardOk());
      setupFkMocks();
      mockRpc.mockResolvedValueOnce({ error: null });

      const res = await POST(makeRequest({ ...validBody, currency: cur }));
      expect(res.status).toBe(201);
    }
  });

  it('returns 400 for invalid date format', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ ...validBody, startDate: 'not-a-date' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when end date before start date', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({
        ...validBody,
        startDate: futureDate(10),
        endDate: futureDate(1),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 when start date is in the past', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = yesterday.toISOString().split('T')[0];

    const res = await POST(
      makeRequest({
        ...validBody,
        startDate: pastDate,
        endDate: futureDate(5),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('past');
  });

  it('returns 400 when working days out of range', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ ...validBody, workingDays: 20 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('between 1 and 14');
  });

  it('returns 400 when working days exceed date range span', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({
        ...validBody,
        startDate: futureDate(1),
        endDate: futureDate(3),
        workingDays: 5,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cannot exceed');
    expect(body.error).toContain('date range');
  });

  it('allows working days equal to date range span', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({
        ...validBody,
        startDate: futureDate(1),
        endDate: futureDate(3),
        workingDays: 3,
      }),
    );
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid meals', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({ ...validBody, meals: ['snack'] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid meal');
  });

  it('returns 404 when vessel not owned', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks({ vessel: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it('returns 400 when role ID is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks({ role: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('role ID');
  });

  it('returns 400 when port ID is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks({ port: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('port/marina ID');
  });

  it('returns 400 when experience bracket ID is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockFromAuth.mockReturnValueOnce(makeSingleChain(null));

    const res = await POST(
      makeRequest({ ...validBody, experienceBracketId: 'bad-id' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('experience bracket ID');
  });

  it('returns 201 on successful posting', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'DAYWORK.POSTED',
        p_payload: expect.objectContaining({
          day_rate: 250,
          currency: 'EUR',
        }),
      }),
    );
  });

  it('accepts workingDayDates and derives workingDays from array length', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const dates = [futureDate(1), futureDate(3), futureDate(5)];
    const res = await POST(
      makeRequest({ ...validBody, workingDayDates: dates, workingDays: 5 }),
    );
    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          working_days: 3,
          working_day_dates: dates,
        }),
      }),
    );
  });

  it('returns 400 when workingDayDates contains dates outside range', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(
      makeRequest({
        ...validBody,
        workingDayDates: [futureDate(10)],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('within the start-end date range');
  });

  it('returns 400 when workingDayDates contains duplicates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const d = futureDate(2);
    const res = await POST(
      makeRequest({
        ...validBody,
        workingDayDates: [d, d],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('duplicates');
  });

  it('includes permanent_opportunity true in payload when provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ ...validBody, permanentOpportunity: true }),
    );
    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          permanent_opportunity: true,
        }),
      }),
    );
  });

  it('defaults permanent_opportunity to false when not provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          permanent_opportunity: false,
        }),
      }),
    );
  });
});
