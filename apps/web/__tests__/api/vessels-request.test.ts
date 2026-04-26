import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/vessels/request/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn();
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockNotify = vi.fn();
vi.mock('@/lib/push-triggers/vessel-admin-notify', () => ({
  notifyAdminsOfVesselRequest: (...args: unknown[]) => mockNotify(...args),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/vessels/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockFromService },
    },
  };
}

const sizeBands = [
  { id: 'sb1', min_meters: 24, max_meters: 30 },
  { id: 'sb2', min_meters: 30, max_meters: 50 },
  { id: 'sb3', min_meters: 50, max_meters: null },
];

const validBody = {
  imo_number: '7654321',
  name: 'MY Stress Yacht',
  vessel_type: 'motor',
  loa_meters: 40,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/vessels/request', () => {
  it('401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it('400 when IMO is not exactly 7 digits', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeReq({ ...validBody, imo_number: '12345' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/7 digits/);
  });

  it('400 when name is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeReq({ ...validBody, name: '' }));
    expect(res.status).toBe(400);
  });

  it('400 when vessel_type is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeReq({ ...validBody, vessel_type: 'submarine' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/motor or sail/);
  });

  it('400 when LOA is out of range', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeReq({ ...validBody, loa_meters: 250 }));
    expect(res.status).toBe(400);
  });

  it('400 when year_built is out of range', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: sizeBands, error: null }),
      }),
    });
    const res = await POST(makeReq({ ...validBody, year_built: 1700 }));
    expect(res.status).toBe(400);
  });

  it('409 when this user already submitted the same IMO', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // sizeBands lookup
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: sizeBands, error: null }),
      }),
    });
    // service-client lookup finds an existing vessel for this user.
    mockFromService.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
          }),
        }),
      }),
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(409);
  });

  it('happy path: fires VESSEL.CREATED with source=pending and admin notification', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // 1. sizeBands
    let authCalls = 0;
    mockFromAuth.mockImplementation(() => {
      authCalls++;
      // Profile lookup last is via serviceClient, not authClient
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: sizeBands, error: null }),
        }),
      };
    });

    // 2. serviceClient: existing IMO check (none) + profile lookup
    let serviceCalls = 0;
    mockFromService.mockImplementation(() => {
      serviceCalls++;
      if (serviceCalls === 1) {
        // existing-IMO check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      // profile lookup for submitter name
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { display_name: 'Alice' }, error: null }),
          }),
        }),
      };
    });

    mockAppendEvent.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(authCalls).toBe(1);

    // VESSEL.CREATED with source='pending'
    expect(mockAppendEvent).toHaveBeenCalled();
    const createCall = mockAppendEvent.mock.calls[0][1] as {
      eventType: string;
      payload: Record<string, unknown>;
    };
    expect(createCall.eventType).toBe('VESSEL.CREATED');
    expect(createCall.payload.source).toBe('pending');
    expect(createCall.payload.imo_number).toBe('7654321');
    expect(createCall.payload.size_band_id).toBe('sb2'); // 40m falls in sb2 (30-50)

    // Admin notification fired with the submitter's display name
    expect(mockNotify).toHaveBeenCalled();
    const [, notifyArgs] = mockNotify.mock.calls[0];
    expect(notifyArgs.submitterName).toBe('Alice');
    expect(notifyArgs.imoNumber).toBe('7654321');
  });

  it('also fires VESSEL.REFLAGGED when flag_state_id is provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    let authCalls = 0;
    mockFromAuth.mockImplementation(() => {
      authCalls++;
      if (authCalls === 1) {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: sizeBands, error: null }),
          }),
        };
      }
      // flag_states lookup
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { id: 'CYM', name: 'Cayman Islands' }, error: null }),
          }),
        }),
      };
    });

    let serviceCalls = 0;
    mockFromService.mockImplementation(() => {
      serviceCalls++;
      if (serviceCalls === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    mockAppendEvent.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);

    const res = await POST(makeReq({ ...validBody, flag_state_id: 'CYM' }));
    expect(res.status).toBe(201);

    const eventTypes = mockAppendEvent.mock.calls.map((c) => (c[1] as { eventType: string }).eventType);
    expect(eventTypes).toContain('VESSEL.CREATED');
    expect(eventTypes).toContain('VESSEL.REFLAGGED');
  });

  it('also fires VESSEL.METADATA_UPDATED when enrichment fields are set', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: sizeBands, error: null }),
      }),
    });
    mockFromService.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));
    mockAppendEvent.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);

    const res = await POST(
      makeReq({ ...validBody, year_built: 2010, builder: 'Feadship', gross_tonnage: 250 }),
    );
    expect(res.status).toBe(201);
    const eventTypes = mockAppendEvent.mock.calls.map((c) => (c[1] as { eventType: string }).eventType);
    expect(eventTypes).toContain('VESSEL.METADATA_UPDATED');
    const metaCall = mockAppendEvent.mock.calls.find(
      (c) => (c[1] as { eventType: string }).eventType === 'VESSEL.METADATA_UPDATED',
    )?.[1] as { payload: Record<string, unknown> };
    expect(metaCall.payload).toMatchObject({
      year_built: 2010,
      builder: 'Feadship',
      gross_tonnage: 250,
    });
  });
});
