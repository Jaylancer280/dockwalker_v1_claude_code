import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as selectApplicant } from '@/app/api/permanent/[id]/applicants/[crewId]/select/route';
import { POST as shortlistApplicant } from '@/app/api/permanent/[id]/applicants/[crewId]/shortlist/route';
import { POST as rejectApplicant } from '@/app/api/permanent/[id]/applicants/[crewId]/reject/route';
import { POST as revertSelection } from '@/app/api/permanent/[id]/revert/route';
import { POST as closeEngagement } from '@/app/api/permanent/engagements/[id]/close/route';

/**
 * Audit P1-T1 (2026-04-30): the 5 permanent state-machine routes
 * lacked unit-test coverage. Each route gates on hat + posting
 * ownership + application/engagement state, then fires its
 * domain event. These tests assert the gate logic + event payload
 * shape using the same thenable-mock pattern documented in
 * tasks/lessons.md.
 */

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockRequireSubscription = vi.fn();
vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: (...args: unknown[]) => mockRequireSubscription(...args),
}));

const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();

function chainSingle(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.not = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data });
  self.maybeSingle = vi.fn().mockResolvedValue({ data });
  return self;
}

function chainCount(count: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ count, data: null, error: null }).then(resolve);
  return self;
}

function guardOk(hat: 'employer' | 'agent' | 'crew' = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: 'employer-1' },
      person: { id: 'employer-1', identity_type: 'employer', current_hat: hat },
      profile: { person_id: 'employer-1' },
      supabase: { from: mockSupabaseFrom },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

const POSTING_ACTIVE = {
  id: 'post-1',
  employer_person_id: 'employer-1',
  status: 'active',
  shortlist_cap: 5,
};

const POSTING_IN_NEGOTIATION = {
  ...POSTING_ACTIVE,
  status: 'in_negotiation',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
  mockRequireSubscription.mockResolvedValue({ ok: false });
});

// =============================================================================
// PERMANENT.SHORTLISTED
// =============================================================================
describe('POST /api/permanent/[id]/applicants/[crewId]/shortlist', () => {
  const params = { params: Promise.resolve({ id: 'post-1', crewId: 'crew-1' }) };

  it('403s for crew hat', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardOk('crew'));
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('404s when posting is missing or not owned', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('400s when posting status is filled', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle({ ...POSTING_ACTIVE, status: 'filled' }));
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
  });

  it('400s when application is missing or not in applied state', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(
      chainSingle({ id: 'app-1', status: 'shortlisted' }),
    );
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
  });

  it('400s with upgrade hint when free-tier shortlist cap reached', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'applied' }));
    mockServiceFrom.mockReturnValueOnce(chainCount(3)); // free tier cap = 3
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/full/i);
    expect(body.upgrade_url).toBe('/billing');
    expect(body.tier_max).toBe(3);
  });

  it('fires PERMANENT.SHORTLISTED with correct payload on happy path', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'applied' }));
    mockServiceFrom.mockReturnValueOnce(chainCount(0));
    const res = await shortlistApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('PERMANENT.SHORTLISTED');
    expect(args.aggregateType).toBe('permanent');
    expect(args.payload).toEqual({
      crew_person_id: 'crew-1',
      permanent_posting_id: 'post-1',
    });
  });
});

// =============================================================================
// PERMANENT.SELECTED
// =============================================================================
describe('POST /api/permanent/[id]/applicants/[crewId]/select', () => {
  const params = { params: Promise.resolve({ id: 'post-1', crewId: 'crew-1' }) };

  it('403s for crew hat', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardOk('crew'));
    const res = await selectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('404s when posting not owned', async () => {
    mockSupabaseFrom.mockReturnValueOnce(
      chainSingle({ ...POSTING_ACTIVE, employer_person_id: 'someone-else' }),
    );
    const res = await selectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('400s when posting is in_negotiation (cannot select twice)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_IN_NEGOTIATION));
    const res = await selectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
  });

  it('400s when application is not shortlisted (must shortlist first)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'applied' }));
    const res = await selectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/shortlisted/i);
  });

  it('fires PERMANENT.SELECTED with engagement_id on happy path', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'shortlisted' }));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'eng-1' }));
    const res = await selectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.engagementId).toBe('eng-1');
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('PERMANENT.SELECTED');
    expect(args.payload.crew_person_id).toBe('crew-1');
    expect(args.payload.permanent_posting_id).toBe('post-1');
    expect(args.payload.engagement_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// =============================================================================
// PERMANENT.REJECTED
// =============================================================================
describe('POST /api/permanent/[id]/applicants/[crewId]/reject', () => {
  const params = { params: Promise.resolve({ id: 'post-1', crewId: 'crew-1' }) };

  it('403s for crew hat', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardOk('crew'));
    const res = await rejectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('404s when posting not owned', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await rejectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(404);
  });

  it('400s when application is in terminal state (selected/rejected)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'rejected' }));
    const res = await rejectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
  });

  it('rejects an applied application (happy path)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'applied' }));
    const res = await rejectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0]![1].eventType).toBe('PERMANENT.REJECTED');
  });

  it('rejects a shortlisted application (happy path)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    mockServiceFrom.mockReturnValueOnce(chainSingle({ id: 'app-1', status: 'shortlisted' }));
    const res = await rejectApplicant(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// PERMANENT.SELECTION_REVERTED
// =============================================================================
describe('POST /api/permanent/[id]/revert', () => {
  const params = { params: Promise.resolve({ id: 'post-1' }) };

  it('403s for crew hat', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardOk('crew'));
    const res = await revertSelection(new Request('http://localhost/'), params);
    expect(res.status).toBe(403);
  });

  it('400s when posting is not in_negotiation', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_ACTIVE));
    const res = await revertSelection(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/active/i);
  });

  it('400s when no active engagement exists for in_negotiation posting', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_IN_NEGOTIATION));
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await revertSelection(new Request('http://localhost/'), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no active engagement/i);
  });

  it('fires PERMANENT.SELECTION_REVERTED with engagement_id on happy path', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(POSTING_IN_NEGOTIATION));
    mockSupabaseFrom.mockReturnValueOnce(chainSingle({ id: 'eng-1' }));
    const res = await revertSelection(new Request('http://localhost/'), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('PERMANENT.SELECTION_REVERTED');
    expect(args.payload).toEqual({
      permanent_posting_id: 'post-1',
      engagement_id: 'eng-1',
    });
  });
});

// =============================================================================
// PERMANENT.ENGAGEMENT_CLOSED
// =============================================================================
describe('POST /api/permanent/engagements/[id]/close', () => {
  const params = { params: Promise.resolve({ id: 'eng-1' }) };
  const ACTIVE_ENGAGEMENT = {
    id: 'eng-1',
    crew_person_id: 'crew-1',
    employer_person_id: 'employer-1',
    permanent_posting_id: 'post-1',
    status: 'active',
  };

  function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/permanent/engagements/eng-1/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('400s when outcome is missing', async () => {
    const res = await closeEngagement(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it('400s when outcome is invalid', async () => {
    const res = await closeEngagement(makeRequest({ outcome: 'success' }), params);
    expect(res.status).toBe(400);
  });

  it('404s when permanent engagement not found', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await closeEngagement(makeRequest({ outcome: 'successful_placement' }), params);
    expect(res.status).toBe(404);
  });

  it('403s when caller is not a participant', async () => {
    mockRequireDomainUser.mockResolvedValueOnce({
      ok: true,
      value: {
        ...guardOk('crew').value,
        user: { id: 'stranger' },
      },
    });
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_ENGAGEMENT));
    const res = await closeEngagement(makeRequest({ outcome: 'successful_placement' }), params);
    expect(res.status).toBe(403);
  });

  it('400s when engagement is already closed', async () => {
    mockSupabaseFrom.mockReturnValueOnce(
      chainSingle({ ...ACTIVE_ENGAGEMENT, status: 'closed' }),
    );
    const res = await closeEngagement(makeRequest({ outcome: 'successful_placement' }), params);
    expect(res.status).toBe(400);
  });

  it('fires PERMANENT.ENGAGEMENT_CLOSED with closed_by=employer when employer closes', async () => {
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_ENGAGEMENT));
    const res = await closeEngagement(makeRequest({ outcome: 'successful_placement' }), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('PERMANENT.ENGAGEMENT_CLOSED');
    expect(args.payload).toEqual({
      engagement_id: 'eng-1',
      outcome: 'successful_placement',
      closed_by: 'employer',
    });
  });

  it('fires with closed_by=crew when crew closes', async () => {
    mockRequireDomainUser.mockResolvedValueOnce({
      ok: true,
      value: {
        ...guardOk('crew').value,
        user: { id: 'crew-1' },
        person: { id: 'crew-1', identity_type: 'crew', current_hat: 'crew' },
      },
    });
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_ENGAGEMENT));
    const res = await closeEngagement(makeRequest({ outcome: 'withdrew' }), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0]![1].payload.closed_by).toBe('crew');
  });
});

// Suppress unused-import warning for NextResponse — we don't construct
// responses here but vitest may load the route's NextResponse usage.
void NextResponse;
