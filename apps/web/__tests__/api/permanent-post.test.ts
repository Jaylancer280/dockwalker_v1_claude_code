import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
        single: vi.fn().mockResolvedValue({ data }),
        in: vi.fn().mockResolvedValue({ data: data ? [data] : [] }),
      }),
    }),
  };
}

function guardOk(userId = 'emp1', hat: 'employer' | 'agent' = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: hat },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockFromService, rpc: mockRpc },
    },
  };
}

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/permanent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  vesselId: 'v1',
  roleId: 'r1',
  locationPortId: 'p1',
  startDate: '2099-01-01',
  salaryMin: 3000,
  salaryMax: 5000,
  salaryCurrency: 'EUR',
  salaryPeriod: 'monthly',
  liveAboard: true,
};

describe('POST /api/permanent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 403 when hat is crew', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        user: { id: 'u1' },
        person: { id: 'u1', current_hat: 'crew' },
        profile: {},
        supabase: { from: mockFromAuth },
        serviceClient: { from: mockFromService, rpc: mockRpc },
      },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ vesselId: 'v1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when salaryMax < salaryMin', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ ...validBody, salaryMin: 5000, salaryMax: 3000 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('salaryMax');
  });

  it('returns 400 when salaryCurrency is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ ...validBody, salaryCurrency: 'YEN' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when salaryPeriod is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ ...validBody, salaryPeriod: 'weekly' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when vessel not owned by user', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Vessel returns null (not found/not owned)
    mockFromAuth
      .mockReturnValueOnce(makeChain(null)) // vessel
      .mockReturnValueOnce(makeChain({ id: 'r1' })) // role
      .mockReturnValueOnce(makeChain({ id: 'p1' })); // port
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Vessel');
  });

  it('returns 400 when shortlistCap < 1 or > 20', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ ...validBody, shortlistCap: 25 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('shortlistCap');
  });

  it('happy path — creates permanent posting, returns { id } with 201', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain({ id: 'v1' })) // vessel
      .mockReturnValueOnce(makeChain({ id: 'r1' })) // role
      .mockReturnValueOnce(makeChain({ id: 'p1' })); // port
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const callArgs = mockAppendEvent.mock.calls[0];
    expect(callArgs[1].eventType).toBe('PERMANENT.POSTED');
    expect(callArgs[1].aggregateType).toBe('permanent');
    expect(callArgs[1].payload.salary_min).toBe(3000);
    expect(callArgs[1].payload.salary_max).toBe(5000);
    expect(callArgs[1].payload.live_aboard).toBe(true);
  });

  it('happy path with optional fields (certificationIds, experienceBracketId, notes)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain({ id: 'v1' })) // vessel
      .mockReturnValueOnce(makeChain({ id: 'r1' })) // role
      .mockReturnValueOnce(makeChain({ id: 'p1' })) // port
      .mockReturnValueOnce(makeChain({ id: 'eb1' })); // experience bracket
    // Mock cert validation
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }] }),
      }),
    });
    const res = await POST(
      makeRequest({
        ...validBody,
        requiredCertificationIds: ['c1', 'c2'],
        experienceBracketId: 'eb1',
        notes: 'Looking for experienced crew with charter background',
        shortlistCap: 10,
      }),
    );
    expect(res.status).toBe(201);
    const callArgs = mockAppendEvent.mock.calls[0];
    expect(callArgs[1].payload.required_certification_ids).toEqual(['c1', 'c2']);
    expect(callArgs[1].payload.experience_bracket_id).toBe('eb1');
    expect(callArgs[1].payload.shortlist_cap).toBe(10);
    expect(callArgs[1].payload.notes).toBe('Looking for experienced crew with charter background');
  });
});
