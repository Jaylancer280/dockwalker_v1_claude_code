import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as DayworkPOST } from '@/app/api/daywork/route';
import { POST as AcceptPOST } from '@/app/api/daywork/[id]/applicants/[crewId]/accept/route';
import { POST as UpdatePositionsPOST } from '@/app/api/daywork/[id]/update-positions/route';
// CancelEmployerPOST and DiscoverGET tested via integration tests

// --- Mocks ---
const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  appendEvents: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

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
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { from: mockFromService, rpc: mockRpc },
      ...overrides,
    },
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// POST /api/daywork — positionsAvailable field
// =========================================================================
describe('POST /api/daywork — multi-crew positions', () => {

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

  function setupFkMocks() {
    mockFromAuth
      .mockReturnValueOnce(makeSingleChain({ id: 'v1' }))
      .mockReturnValueOnce(makeSingleChain({ id: 'r1' }))
      .mockReturnValueOnce(makeSingleChain({ id: 'p1' }));
  }

  it('passes positionsAvailable=3 through to payload', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();

    const req = new Request('http://localhost/api/daywork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, positionsAvailable: 3 }),
    });

    const res = await DayworkPOST(req);
    expect(res.status).toBe(201);

    const payload = mockAppendEvent.mock.calls[0][1].payload;
    expect(payload.positions_available).toBe(3);
  });

  it('defaults positionsAvailable to 1 when omitted', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    setupFkMocks();

    const req = new Request('http://localhost/api/daywork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const res = await DayworkPOST(req);
    expect(res.status).toBe(201);

    const payload = mockAppendEvent.mock.calls[0][1].payload;
    expect(payload.positions_available).toBe(1);
  });

  it('rejects positionsAvailable > 20', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const req = new Request('http://localhost/api/daywork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, positionsAvailable: 25 }),
    });

    const res = await DayworkPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('positionsAvailable');
  });
});

// =========================================================================
// POST /api/daywork/[id]/applicants/[crewId]/accept — multi-crew
// =========================================================================
describe('POST /api/daywork/:id/applicants/:crewId/accept — multi-crew', () => {

  const params = Promise.resolve({ id: 'dw1', crewId: 'crew1' });

  it('returns 400 when all positions are filled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // daywork query
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({
        id: 'dw1',
        poster_person_id: 'u1',
        start_date: futureDate(1),
        end_date: futureDate(5),
        status: 'active',
        positions_available: 3,
        positions_filled: 3,
      }),
    );

    const req = new Request('http://localhost/api/daywork/dw1/applicants/crew1/accept', {
      method: 'POST',
    });

    const res = await AcceptPOST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('All positions are filled');
  });

  it('succeeds when positions remain', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // daywork query
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({
        id: 'dw1',
        poster_person_id: 'u1',
        start_date: futureDate(1),
        end_date: futureDate(5),
        status: 'active',
        positions_available: 3,
        positions_filled: 1,
      }),
    );

    // application query
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'app1', status: 'applied' }),
    );

    // check_no_overlap
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    // engagement select after accept
    mockFromService.mockReturnValueOnce(
      makeSingleChain({ id: 'eng1' }),
    );

    const req = new Request('http://localhost/api/daywork/dw1/applicants/crew1/accept', {
      method: 'POST',
    });

    const res = await AcceptPOST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// =========================================================================
// POST /api/daywork/[id]/update-positions
// =========================================================================
describe('POST /api/daywork/:id/update-positions', () => {

  const params = Promise.resolve({ id: 'dw1' });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new Request('http://localhost/api/daywork/dw1/update-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionsAvailable: 2 }),
    });

    const res = await UpdatePositionsPOST(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({
        id: 'dw1',
        poster_person_id: 'other-user',
        status: 'active',
        positions_available: 4,
        positions_filled: 0,
      }),
    );

    const req = new Request('http://localhost/api/daywork/dw1/update-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionsAvailable: 2 }),
    });

    const res = await UpdatePositionsPOST(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 400 when reducing below filled count', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({
        id: 'dw1',
        poster_person_id: 'u1',
        status: 'active',
        positions_available: 4,
        positions_filled: 3,
      }),
    );

    const req = new Request('http://localhost/api/daywork/dw1/update-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionsAvailable: 2 }),
    });

    const res = await UpdatePositionsPOST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('filled count');
  });

  it('succeeds when reducing to filled count (triggers transition)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({
        id: 'dw1',
        poster_person_id: 'u1',
        status: 'active',
        positions_available: 4,
        positions_filled: 2,
      }),
    );

    const req = new Request('http://localhost/api/daywork/dw1/update-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionsAvailable: 2 }),
    });

    const res = await UpdatePositionsPOST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.positions_available).toBe(2);

    // Verify event was appended
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'DAYWORK.POSITIONS_UPDATED',
        payload: { daywork_id: 'dw1', positions_available: 2 },
      }),
    );
  });
});

// Discover and cancel-employer tests are omitted here due to complex mock chain requirements.
// These routes are covered by the integration test suite against the real database.
