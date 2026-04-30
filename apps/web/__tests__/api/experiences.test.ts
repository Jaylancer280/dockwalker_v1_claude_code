import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/experiences/route';
import { PATCH, DELETE } from '@/app/api/experiences/[id]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { from: mockServiceFrom, rpc: vi.fn() },
      ...overrides,
    },
  };
}

function mockServiceQuery(table: string, data: unknown) {
  mockServiceFrom.mockImplementationOnce((t: string) => {
    if (t !== table) throw new Error(`Unexpected table: ${t}`);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data }),
          }),
        }),
      }),
    };
  });
}

function mockServiceExperiences(data: unknown) {
  mockServiceFrom.mockImplementationOnce(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data }),
    }),
  }));
}

/**
 * Mock the snapshot-field edit-lock count query (references count when
 * caller changes role/start/end on an experience). Returns count=0 by
 * default — the lock only fires when active references exist.
 */
function mockReferencesEditLockCount(count = 0) {
  mockServiceFrom.mockImplementationOnce((t: string) => {
    if (t !== 'references') throw new Error(`Unexpected table for edit-lock: ${t}`);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ count }),
        }),
      }),
    };
  });
}

/**
 * Mock both the edit-lock count query AND the follow-up thisExp lookup
 * (00129 path: when count > 0, the route reads role_id/start_date/end_date/
 * is_current to decide if a closing transition is allowed).
 */
function mockEditLockWithRefs(opts: {
  count: number;
  roleId: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}) {
  mockReferencesEditLockCount(opts.count);
  mockServiceFrom.mockImplementationOnce((t: string) => {
    if (t !== 'crew_experiences')
      throw new Error(`Unexpected table for thisExp lookup: ${t}`);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              role_id: opts.roleId,
              start_date: opts.startDate,
              end_date: opts.endDate,
              is_current: opts.isCurrent,
            },
          }),
        }),
      }),
    };
  });
}

/**
 * Mock the DELETE-route's references-affected-referees lookup + the
 * requester display_name profile lookup. Default = no affected referees.
 */
function mockDeleteReferencesPreflight(rows: unknown[] = []) {
  // references query
  mockServiceFrom.mockImplementationOnce((t: string) => {
    if (t !== 'references') throw new Error(`Unexpected table: ${t}`);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: rows }),
          }),
        }),
      }),
    };
  });
  // profiles display_name lookup
  mockServiceFrom.mockImplementationOnce((t: string) => {
    if (t !== 'profiles') throw new Error(`Unexpected table: ${t}`);
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { display_name: 'Test Crew' } }),
        }),
      }),
    };
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/experiences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/experiences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request("http://localhost/api/experiences"));
    expect(res.status).toBe(401);
  });

  it('returns 200 with experiences list', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const experiences = [
      {
        id: 'exp1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        is_current: false,
        vessel_operation: 'charter',
        flag_state: 'GBR',
        contract_type: 'rotational',
        contract_details: null,
        description: 'Deckhand on M/Y Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        vessels: { id: 'v1', imo_number: '1234567', name: 'Test', vessel_type: 'motor', size_band_id: 'sb1', loa_meters: 45, vessel_size_bands: { label: '40-50m' } },
        yacht_roles: { id: 'r1', name: 'Deckhand', department: 'deck' },
      },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: experiences, error: null }),
        }),
      }),
    });
    // resolveHistoricalVesselNames issues a follow-up query against
    // vessel_names — return empty so the enrichment is a no-op.
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    // Per-experience active reference count lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // Caller's subscription plan lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await GET(new Request("http://localhost/api/experiences"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiences).toHaveLength(1);
    expect(body.experiences[0].id).toBe('exp1');
    expect(body.experiences[0].historical_vessel_name).toBeNull();
    expect(body.subscription_plan).toBe('free');
  });

  it('surfaces a historical name when vessel was renamed after the experience', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const experiences = [
      {
        id: 'exp1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2019-06-01',
        end_date: '2020-06-01',
        is_current: false,
        vessel_operation: 'charter',
        flag_state: 'GBR',
        contract_type: 'rotational',
        contract_details: null,
        description: null,
        created_at: '2019-06-01',
        updated_at: '2019-06-01',
        vessels: {
          id: 'v1',
          imo_number: '1234567',
          name: 'Black Pearl',
          vessel_type: 'motor',
          size_band_id: 'sb1',
          loa_meters: 45,
          vessel_size_bands: { label: '40-50m' },
        },
        yacht_roles: { id: 'r1', name: 'Deckhand', department: 'deck' },
      },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: experiences, error: null }),
        }),
      }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                vessel_id: 'v1',
                name: 'Black Pearl',
                effective_from: '2021-01-01',
                effective_to: null,
              },
              {
                vessel_id: 'v1',
                name: 'Sea Wolf',
                effective_from: '2018-01-01',
                effective_to: '2020-12-31',
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    // references active count lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // subscription plan lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await GET(new Request("http://localhost/api/experiences"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiences[0].historical_vessel_name).toBe('Sea Wolf');
    expect(body.experiences[0].vessels.name).toBe('Black Pearl');
  });
});

describe('POST /api/experiences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required fields are missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({ vesselId: 'v1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid vesselOperation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      vesselOperation: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid contract type', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      vesselOperation: 'charter',
      contractType: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when end date is before start date', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-06-01',
      endDate: '2024-01-01',
      vesselOperation: 'charter',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date');
  });

  it('returns 400 for description over 250 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      vesselOperation: 'charter',
      description: 'x'.repeat(251),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // No is_current, so only the overlap query fires
    mockServiceExperiences([]);

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      vesselOperation: 'charter',
      flagState: 'GBR',
      contractType: 'rotational',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.ADDED');
  });

  it('returns 409 when dates overlap with existing experience', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Existing experience: Jan-Jun 2024
    mockServiceExperiences([
      { id: 'exp-existing', start_date: '2024-01-01', end_date: '2024-06-01' },
    ]);

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-03-01',
      endDate: '2024-09-01',
      vesselOperation: 'charter',
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('overlap');
  });

  it('allows future experience alongside open-ended current role', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // No is_current check needed (isCurrent not set)
    // Existing: open-ended from 2024-01-01 (no end date)
    mockServiceExperiences([
      { id: 'exp-current', start_date: '2024-01-01', end_date: null },
    ]);

    // Future experience: starts next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const futureStart = nextMonth.toISOString().split('T')[0];
    const futureEnd = new Date(nextMonth.getTime() + 30 * 86400000).toISOString().split('T')[0];

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: futureStart,
      endDate: futureEnd,
      vesselOperation: 'charter',
    }));
    expect(res.status).toBe(201);
  });

  it('blocks overlapping experience when open-ended role exists and start is in past', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Existing: open-ended from 2024-01-01 (no end date)
    mockServiceExperiences([
      { id: 'exp-current', start_date: '2024-01-01', end_date: null },
    ]);

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-06-01',
      endDate: '2024-12-01',
      vesselOperation: 'charter',
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('overlap');
  });

  it('returns 409 when is_current and another current exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // is_current check returns existing current
    mockServiceQuery('crew_experiences', [{ id: 'exp-current' }]);

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2025-01-01',
      vesselOperation: 'charter',
      isCurrent: true,
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('current experience');
  });
});

describe('PATCH /api/experiences/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when experience not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 'r2' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    // Edit-lock count (no active references → unlocked)
    mockReferencesEditLockCount(0);

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 'r2', vesselOperation: 'private' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.UPDATED');
  });

  it('returns 409 when updated dates overlap with another experience', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Ownership check
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    // Edit-lock count (no active references → unlocked)
    mockReferencesEditLockCount(0);
    // Fetch this experience's current dates
    mockServiceFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { start_date: '2024-01-01', end_date: '2024-06-01' },
          }),
        }),
      }),
    }));
    // Fetch other experiences (has overlapping one)
    mockServiceFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({
            data: [{ id: 'exp2', start_date: '2024-03-01', end_date: '2024-09-01' }],
          }),
        }),
      }),
    }));

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2024-01-01', endDate: '2024-08-01' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('overlap');
  });

  it('00129: allows null→date end_date transition when currently-onboard with active refs', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    mockEditLockWithRefs({
      count: 2,
      roleId: 'r1',
      startDate: '2024-01-01',
      endDate: null,
      isCurrent: true,
    });
    // Date-overlap check still runs — fetch thisExp dates + others (none).
    mockServiceFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { start_date: '2024-01-01', end_date: null },
          }),
        }),
      }),
    }));
    mockServiceFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    }));

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate: '2025-04-30', isCurrent: false }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
  });

  it('00129: rejects end_date change on already-completed experience with active refs', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    mockEditLockWithRefs({
      count: 1,
      roleId: 'r1',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      isCurrent: false,
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate: '2024-08-01' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.locked_fields).toContain('end_date');
  });

  it('00129: rejects role change on currently-onboard experience with active refs', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    mockEditLockWithRefs({
      count: 1,
      roleId: 'r1',
      startDate: '2024-01-01',
      endDate: null,
      isCurrent: true,
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 'r2' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.locked_fields).toContain('role');
  });
});

describe('DELETE /api/experiences/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when experience not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('exp1'));
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful delete', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });
    // Fix A — references-affected lookup + requester profile lookup
    mockDeleteReferencesPreflight([]);

    const req = new Request('http://localhost/api/experiences/exp1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('exp1'));
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.REMOVED');
  });
});

describe('Agent maritime background constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const agentGuard = () =>
    guardOk({ person: { id: 'u1', identity_type: 'agent', current_hat: 'agent' } });

  it('POST rejects isCurrent: true for agents', async () => {
    mockRequireDomainUser.mockResolvedValue(agentGuard());

    const req = new Request('http://localhost/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId: 'v1',
        roleId: 'r1',
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        isCurrent: true,
        vesselOperation: 'charter',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cannot mark experience as current');
  });

  it('POST rejects missing endDate for agents', async () => {
    mockRequireDomainUser.mockResolvedValue(agentGuard());

    const req = new Request('http://localhost/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId: 'v1',
        roleId: 'r1',
        startDate: '2024-01-01',
        vesselOperation: 'charter',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date is required');
  });

  it('POST succeeds for agent with isCurrent: false and endDate', async () => {
    mockRequireDomainUser.mockResolvedValue(agentGuard());
    // Overlap check — no existing experiences
    mockServiceQuery('crew_experiences', []);

    const req = new Request('http://localhost/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId: 'v1',
        roleId: 'r1',
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        isCurrent: false,
        vesselOperation: 'charter',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('PATCH rejects isCurrent: true for agents', async () => {
    mockRequireDomainUser.mockResolvedValue(agentGuard());
    // Ownership check mock
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCurrent: true }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cannot mark experience as current');
  });

  it('PATCH rejects clearing endDate for agents', async () => {
    mockRequireDomainUser.mockResolvedValue(agentGuard());
    // Ownership check mock
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate: null }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('End date is required');
  });
});
