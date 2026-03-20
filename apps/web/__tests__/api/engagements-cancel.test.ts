import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as cancelCrew } from '@/app/api/engagements/[id]/cancel-crew/route';
import { POST as cancelEmployer } from '@/app/api/engagements/[id]/cancel-employer/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  const inner = { not: vi.fn(), single: vi.fn().mockResolvedValue({ data }) };
  inner.not.mockReturnValue(inner);
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(inner),
    }),
  };
}

// Mock for serviceClient.from('active_engagements') count query — returns 0 (no other engagements)
function mockNoOtherEngagements() {
  mockFromService.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ count: 0 }),
        }),
      }),
    }),
  });
}

function guardOk(hat: 'crew' | 'employer' = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: hat },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockFromService, rpc: mockRpc },
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

describe('POST /api/engagements/:id/cancel-crew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await cancelCrew(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await cancelCrew(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the crew member', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'other', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(makeRequest({ reason_category: 'personal_reasons' }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'completed' }),
    );

    const res = await cancelCrew(makeRequest({ reason_category: 'personal_reasons' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason_category is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_category/);
  });

  it('returns 400 when reason_category is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(
      makeRequest({ reason_category: 'vessel_leaving' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_category/);
  });

  it('returns 400 when reason_category=other but no reason_text', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(
      makeRequest({ reason_category: 'other' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_text/);
  });

  it('returns 400 when reason_text exceeds 250 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );

    const res = await cancelCrew(
      makeRequest({ reason_category: 'other', reason_text: 'x'.repeat(251) }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/250/);
  });

  it('returns 200 for personal_reasons cancellation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await cancelCrew(
      makeRequest({ reason_category: 'personal_reasons' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('ENGAGEMENT.CANCELLED_BY_CREW');
    expect(events[0].payload.reason_category).toBe('personal_reasons');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    expect(events[1].payload.is_system).toBe(true);
    expect(events[1].payload.content).toMatch(/Personal circumstances/);
  });

  it('returns 200 for found_other_work cancellation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await cancelCrew(
      makeRequest({ reason_category: 'found_other_work' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[1].payload.content).toMatch(/another job/);
  });

  it('returns 200 for unsafe_conditions cancellation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await cancelCrew(
      makeRequest({ reason_category: 'unsafe_conditions' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[1].payload.content).toMatch(/Safety/);
  });

  it('returns 200 for other reason with custom text', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'e1', crew_person_id: 'u1', daywork_id: 'd1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await cancelCrew(
      makeRequest({ reason_category: 'other', reason_text: 'Family emergency' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].payload.reason_category).toBe('other');
    expect(events[0].payload.reason_text).toBe('Family emergency');
    expect(events[1].payload.content).toMatch(/Family emergency/);
  });
});

describe('POST /api/engagements/:id/cancel-employer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew'));

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only employers');
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'other',
        daywork_id: 'd1', status: 'active',
      }),
    );

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'cancelled',
      }),
    );

    const res = await cancelEmployer(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason_category missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'active',
      }),
    );

    const req = makeRequest({});
    const res = await cancelEmployer(req, makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason_category is other but no reason_text', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'active',
      }),
    );

    const req = makeRequest({ reason_category: 'other', relist_requested: false });
    const res = await cancelEmployer(req, makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful employer cancellation with structured reason', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
        daywork_id: 'd1', status: 'active',
      }),
    );
    mockNoOtherEngagements();
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null });

    const req = makeRequest({
      reason_category: 'vessel_leaving',
      relist_requested: false,
    });
    const res = await cancelEmployer(req, makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relisted).toBe(false);
    expect(mockRpc.mock.calls[0][1].p_events[0].event_type).toBe('ENGAGEMENT.CANCELLED_BY_EMPLOYER');
  });

  it('emits DAYWORK.RELISTED when relist_requested and future dates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'c1', employer_person_id: 'u1',
          daywork_id: 'd1', status: 'active',
        }),
      )
      .mockReturnValueOnce(
        makeChain({ start_date: '2099-01-01' }),
      );
    mockNoOtherEngagements();
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null });

    const req = makeRequest({
      reason_category: 'vessel_operational',
      relist_requested: true,
      relist_reason_category: 'different_skills',
    });
    const res = await cancelEmployer(req, makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.relisted).toBe(true);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[2].event_type).toBe('DAYWORK.RELISTED');
  });
});
