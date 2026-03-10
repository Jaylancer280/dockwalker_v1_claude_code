import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as proposePostponement } from '@/app/api/engagements/[id]/propose-postponement/route';
import { POST as respondPostponement } from '@/app/api/engagements/[id]/respond-postponement/route';

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
  postponement_status: null,
  work_started_status: null,
};

const engagementWithProposal = {
  ...activeEngagement,
  crew_person_id: 'u1', // crew is the user for respond
  employer_person_id: 'emp1',
  postponement_status: 'proposed',
  proposed_start_date: '2099-06-01',
  proposed_end_date: '2099-06-10',
  proposed_working_days: 5,
};

describe('POST /api/engagements/:id/propose-postponement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await proposePostponement(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not the employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, employer_person_id: 'other' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, status: 'cancelled' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when already has pending proposal', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, postponement_status: 'proposed' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when dates are invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await proposePostponement(
      makeRequest({ start_date: '2020-01-01', end_date: '2020-01-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when end_date before start_date', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-10', end_date: '2099-06-01', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when working_days exceeds span', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-03', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when work has started (confirmed)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, work_started_status: 'confirmed' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('work has started');
  });

  it('returns 400 when postponement already used (accepted)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, postponement_status: 'accepted' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('once');
  });

  it('returns 400 when postponement already used (rejected)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, postponement_status: 'rejected' }),
    );
    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns conflict without cancelling when dates overlap and no confirm', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc.mockResolvedValueOnce({ data: false, error: null }); // overlap check

    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('conflict');
    // No events emitted beyond the overlap check
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('returns conflict_confirmed when overlap + confirm_conflict', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })              // overlap check
      .mockResolvedValueOnce({ data: ['ev1', 'ev2', 'ev3'], error: null }); // batch (cancel + relist + msg)

    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5, confirm_conflict: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('conflict_confirmed');
  });

  it('returns proposed when no overlap', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })                    // no overlap
      .mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });         // batch (propose + msg)

    const res = await proposePostponement(
      makeRequest({ start_date: '2099-06-01', end_date: '2099-06-10', working_days: 5 }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('proposed');
    expect(mockRpc.mock.calls[1][1].p_events[0].event_type).toBe('ENGAGEMENT.POSTPONEMENT_PROPOSED');
  });
});

describe('POST /api/engagements/:id/respond-postponement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when user is not crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...engagementWithProposal, crew_person_id: 'other' }),
    );
    const res = await respondPostponement(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when no pending proposal', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...engagementWithProposal, postponement_status: null }),
    );
    const res = await respondPostponement(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when accepted is not boolean', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(engagementWithProposal));
    const res = await respondPostponement(makeRequest({ accepted: 'yes' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns accepted when crew approves and no overlap', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(engagementWithProposal));
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })                // no overlap recheck
      .mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });     // batch (accept + msg)

    const res = await respondPostponement(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('accepted');
    expect(mockRpc.mock.calls[1][1].p_events[0].event_type).toBe('ENGAGEMENT.POSTPONEMENT_ACCEPTED');
  });

  it('returns conflict_cancelled when crew accepts but overlap appeared', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(engagementWithProposal));
    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })               // overlap detected
      .mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });     // batch (reject + msg)

    const res = await respondPostponement(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('conflict_cancelled');
  });

  it('returns rejected when crew rejects (no auto-relist)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(engagementWithProposal));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch (reject + msg)

    const res = await respondPostponement(makeRequest({ accepted: false }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('rejected');
    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('ENGAGEMENT.POSTPONEMENT_REJECTED');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    // No DAYWORK.RELISTED — employer must choose to relist separately
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
