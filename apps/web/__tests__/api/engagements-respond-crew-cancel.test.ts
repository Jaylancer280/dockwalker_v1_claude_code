import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvents = vi.fn().mockResolvedValue(['ev1', 'ev2']);
vi.mock('@dockwalker/db', () => ({
  appendEvent: vi.fn(),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'emp1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

function makeChain(data: unknown) {
  const inner = { not: vi.fn(), single: vi.fn().mockResolvedValue({ data }) };
  inner.not.mockReturnValue(inner);
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(inner),
    }),
  };
}

const cancelledEngagement = {
  id: 'e1',
  employer_person_id: 'emp1',
  daywork_id: 'dw1',
  status: 'cancelled',
  cancelled_by: 'crew',
};

const inProgressDaywork = {
  id: 'dw1',
  status: 'in_progress',
  start_date: '2027-06-01',
};

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/engagements/:id/respond-crew-cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppendEvents.mockResolvedValue(['ev1', 'ev2']);
  });

  it('employer chooses relist → 200 with action relisted', async () => {
    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-crew-cancel/route'
    );
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(cancelledEngagement));
    mockFromAuth.mockReturnValueOnce(makeChain(inProgressDaywork));

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('relisted');
    expect(mockAppendEvents).toHaveBeenCalledOnce();
  });

  it('employer chooses cancel → 200 with action cancelled', async () => {
    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-crew-cancel/route'
    );
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(cancelledEngagement));
    mockFromAuth.mockReturnValueOnce(makeChain(inProgressDaywork));

    const res = await POST(
      makeRequest({ action: 'cancel' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('cancelled');
    expect(mockAppendEvents).toHaveBeenCalledOnce();
  });

  it('crew hat → 403', async () => {
    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-crew-cancel/route'
    );
    const crewGuard = {
      ok: true,
      value: {
        user: { id: 'crew1' },
        person: { id: 'crew1', identity_type: 'crew', current_hat: 'crew' },
        profile: { person_id: 'crew1' },
        supabase: { from: mockFromAuth },
        serviceClient: { rpc: vi.fn() },
      },
    };
    mockRequireDomainUser.mockResolvedValue(crewGuard);
    // engagement employer_person_id is 'emp1', user.id is 'crew1' → mismatch → 403
    mockFromAuth.mockReturnValueOnce(makeChain(cancelledEngagement));

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('no crew cancellation pending (status active, cancelled_by null) → 400', async () => {
    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-crew-cancel/route'
    );
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        ...cancelledEngagement,
        status: 'active',
        cancelled_by: null,
      }),
    );

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not cancelled by crew/);
  });

  it('daywork not in_progress (status completed) → 400', async () => {
    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-crew-cancel/route'
    );
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(cancelledEngagement));
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...inProgressDaywork, status: 'completed' }),
    );

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no longer available/);
  });
});
