import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as cancelEmployer } from '@/app/api/engagements/[id]/cancel-employer/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const activeEngagement = {
  id: 'e1',
  crew_person_id: 'c1',
  employer_person_id: 'u1',
  daywork_id: 'd1',
  status: 'active',
};

describe('POST /api/engagements/:id/cancel-employer (structured)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when reason_category is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_category/);
  });

  it('returns 400 when reason_category is postponement (not a valid cancel reason)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'postponement', relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_category/);
  });

  it('returns 400 when reason_category=other but no reason_text', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'other', relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_text/);
  });

  it('returns 400 when reason_text exceeds 250 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'other', reason_text: 'x'.repeat(251), relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/250/);
  });

  it('returns 400 when relist_reason_text exceeds 250 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({
        reason_category: 'vessel_leaving',
        relist_requested: true,
        relist_reason_category: 'relist_other',
        relist_reason_text: 'x'.repeat(251),
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/250/);
  });

  it('returns 400 when relist_requested is not boolean', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/relist_requested/);
  });

  it('returns 400 when relist_requested=true but no relist_reason_category', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving', relist_requested: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/relist_reason_category/);
  });

  it('returns 200 for vessel_leaving without relist', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null }); // batch

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving', relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relisted).toBe(false);

    // Single batch call with 3 events
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('ENGAGEMENT.CANCELLED_BY_EMPLOYER');
    expect(events[0].payload.reason_category).toBe('vessel_leaving');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    expect(events[1].payload.is_system).toBe(true);
    expect(events[1].payload.content).toMatch(/Vessel leaving/);
    expect(events[2].event_type).toBe('DAYWORK.CANCELLED_BY_EMPLOYER');
  });

  it('returns 200 for other reason with relist (future start date)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(activeEngagement))
      .mockReturnValueOnce(makeChain({ start_date: '2099-01-01' })); // future
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null }); // batch

    const res = await cancelEmployer(
      makeRequest({
        reason_category: 'other',
        reason_text: 'Custom reason',
        relist_requested: true,
        relist_reason_category: 'wrong_crew',
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relisted).toBe(true);

    const events = mockRpc.mock.calls[0][1].p_events;
    // Relist reason NOT in system message
    expect(events[1].payload.content).not.toMatch(/wrong_crew/);
    expect(events[1].payload.content).toMatch(/Custom reason/);
    // DAYWORK.RELISTED emitted
    expect(events[2].event_type).toBe('DAYWORK.RELISTED');
  });

  it('returns relisted=false when relist requested but start date has passed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(activeEngagement))
      .mockReturnValueOnce(makeChain({ start_date: '2020-01-01' })); // past
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch (cancel + msg, no relist)

    const res = await cancelEmployer(
      makeRequest({
        reason_category: 'vessel_leaving',
        relist_requested: true,
        relist_reason_category: 'wrong_crew',
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.relisted).toBe(false);

    // Only 2 events: cancel + system message (no DAYWORK.RELISTED)
    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe('ENGAGEMENT.CANCELLED_BY_EMPLOYER');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
  });

  it('returns 200 for crew_requirements_changed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null });

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'crew_requirements_changed', relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc.mock.calls[0][1].p_events[1].payload.content).toMatch(/crew requirements/);
  });

  it('returns 200 for vessel_operational', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null });

    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_operational', relist_requested: false }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc.mock.calls[0][1].p_events[1].payload.content).toMatch(/operational/);
  });
});
