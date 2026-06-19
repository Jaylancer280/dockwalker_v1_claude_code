import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as cancelCrew } from '@/app/api/engagements/[id]/cancel-crew/route';
import { POST as cancelEmployer } from '@/app/api/engagements/[id]/cancel-employer/route';
import { POST as closeReferenceContact } from '@/app/api/engagements/[id]/close-reference-contact/route';

/**
 * Audit P1-T1 (2026-04-30): the three crew/employer/reference cancellation
 * routes lacked unit-test coverage. They share a state-machine shape
 * (validate engagement → check participant → fire event(s)) but use
 * different aggregate types (application / application / reference_contact)
 * and different event types.
 */

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
const mockAppendEvents = vi.fn().mockResolvedValue(['evt-1', 'evt-2']);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();

function chainSingle(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.not = vi.fn().mockReturnValue(self);
  self.neq = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data });
  self.maybeSingle = vi.fn().mockResolvedValue({ data });
  return self;
}

function chainCount(count: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.neq = vi.fn().mockReturnValue(self);
  self.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ count, data: null, error: null }).then(resolve);
  return self;
}

function makeRequest(body: unknown, url = 'http://localhost/api/engagements/eng-1/cancel'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: 'eng-1' }) };

const ACTIVE_DW_ENGAGEMENT = {
  id: 'eng-1',
  crew_person_id: 'crew-1',
  employer_person_id: 'employer-1',
  daywork_id: 'dw-1',
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// ENGAGEMENT.CANCELLED_BY_CREW
// =============================================================================
describe('POST /api/engagements/[id]/cancel-crew', () => {
  function guardCrew(userId = 'crew-1') {
    return {
      ok: true,
      value: {
        user: { id: userId },
        person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
        profile: { person_id: userId },
        supabase: { from: mockSupabaseFrom },
        serviceClient: { from: mockServiceFrom },
      },
    };
  }

  it('404s when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await cancelCrew(makeRequest({ reason_category: 'personal_reasons' }), params);
    expect(res.status).toBe(404);
  });

  it('403s when caller is not the crew on the engagement', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew('stranger'));
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelCrew(makeRequest({ reason_category: 'personal_reasons' }), params);
    expect(res.status).toBe(403);
  });

  it('400s when engagement is already cancelled', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(
      chainSingle({ ...ACTIVE_DW_ENGAGEMENT, status: 'cancelled' }),
    );
    const res = await cancelCrew(makeRequest({ reason_category: 'personal_reasons' }), params);
    expect(res.status).toBe(400);
  });

  it('400s when reason_category is missing or invalid', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelCrew(makeRequest({ reason_category: 'invalid' }), params);
    expect(res.status).toBe(400);
  });

  it('400s when reason_category is "other" without reason_text', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelCrew(makeRequest({ reason_category: 'other' }), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reason_text/i);
  });

  it('fires ENGAGEMENT.CANCELLED_BY_CREW + MESSAGE.SENT atomically on happy path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelCrew(
      makeRequest({ reason_category: 'found_other_work' }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0]![1];
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('ENGAGEMENT.CANCELLED_BY_CREW');
    expect(events[0].payload.reason_category).toBe('found_other_work');
    expect(events[0].payload.reason_text).toBeUndefined();
    expect(events[1].eventType).toBe('MESSAGE.SENT');
    expect(events[1].payload.is_system).toBe(true);
    expect(events[1].payload.content).toMatch(/cancelled by crew/i);
  });

  it('threads reason_text only when category is "other"', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardCrew());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    await cancelCrew(
      makeRequest({ reason_category: 'other', reason_text: 'family emergency' }),
      params,
    );
    const events = mockAppendEvents.mock.calls[0]![1];
    expect(events[0].payload.reason_text).toBe('family emergency');
  });
});

// =============================================================================
// ENGAGEMENT.CANCELLED_BY_EMPLOYER
// =============================================================================
describe('POST /api/engagements/[id]/cancel-employer', () => {
  function guardEmp(userId = 'employer-1', hat: 'employer' | 'crew' | 'agent' = 'employer') {
    return {
      ok: true,
      value: {
        user: { id: userId },
        person: { id: userId, identity_type: 'employer', current_hat: hat },
        profile: { person_id: userId },
        supabase: { from: mockSupabaseFrom },
        serviceClient: { from: mockServiceFrom },
      },
    };
  }

  it('403s when current_hat is crew (only employers/agents can cancel)', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp('employer-1', 'crew'));
    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving' }),
      params,
    );
    expect(res.status).toBe(403);
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it('404s when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(null));
    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving' }),
      params,
    );
    expect(res.status).toBe(404);
  });

  it('403s when caller is not the engagement employer', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp('stranger'));
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelEmployer(
      makeRequest({ reason_category: 'vessel_leaving' }),
      params,
    );
    expect(res.status).toBe(403);
  });

  it('400s when reason_category is invalid', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    const res = await cancelEmployer(
      makeRequest({ reason_category: 'unsafe_conditions' /* crew-only category */ }),
      params,
    );
    expect(res.status).toBe(400);
  });

  it('fires ENGAGEMENT.CANCELLED_BY_EMPLOYER + MESSAGE.SENT + DAYWORK.CANCELLED_BY_EMPLOYER on no-relist path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    // 1: engagement lookup via supabase
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    // 2: other-active-engagements count via serviceClient (single-crew posting → 0)
    mockServiceFrom.mockReturnValueOnce(chainCount(0));
    const res = await cancelEmployer(
      makeRequest({
        reason_category: 'vessel_leaving',
        reason_text: 'departing port early',
        relist_requested: false,
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0]![1];
    const cancelEvent = events.find(
      (e: { eventType: string }) => e.eventType === 'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
    );
    expect(cancelEvent).toBeTruthy();
    expect(cancelEvent.payload.reason_category).toBe('vessel_leaving');
    // No-relist path with no other active engagements → daywork is cancelled outright.
    const dwCancel = events.find(
      (e: { eventType: string }) => e.eventType === 'DAYWORK.CANCELLED_BY_EMPLOYER',
    );
    expect(dwCancel).toBeTruthy();
  });

  it('skips DAYWORK.* event when other crew remain on the engagement (multi-position)', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockSupabaseFrom.mockReturnValueOnce(chainSingle(ACTIVE_DW_ENGAGEMENT));
    // 2 other active engagements still on the daywork → cancel just this one.
    mockServiceFrom.mockReturnValueOnce(chainCount(2));
    const res = await cancelEmployer(
      makeRequest({ reason_category: 'crew_requirements_changed', relist_requested: false }),
      params,
    );
    expect(res.status).toBe(200);
    const events = mockAppendEvents.mock.calls[0]![1];
    expect(events.find((e: { eventType: string }) => e.eventType === 'DAYWORK.CANCELLED_BY_EMPLOYER')).toBeUndefined();
    expect(events.find((e: { eventType: string }) => e.eventType === 'DAYWORK.RELISTED')).toBeUndefined();
  });
});

// =============================================================================
// REFERENCE.CONTACT_THREAD_CLOSED
// =============================================================================
describe('POST /api/engagements/[id]/close-reference-contact', () => {
  const REFERENCE_CONTACT_ENGAGEMENT = {
    id: 'eng-ref-1',
    crew_person_id: null,
    employer_person_id: 'employer-1',
    reference_contact_id: 'rc-1',
    status: 'active',
  };

  function guardEmp() {
    return {
      ok: true,
      value: {
        user: { id: 'employer-1' },
        person: { id: 'employer-1', identity_type: 'employer', current_hat: 'employer' },
        profile: { person_id: 'employer-1' },
        supabase: { from: mockSupabaseFrom },
        serviceClient: { from: mockServiceFrom },
      },
    };
  }

  it('404s when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockServiceFrom.mockReturnValueOnce(chainSingle(null));
    const res = await closeReferenceContact(makeRequest({}), params);
    expect(res.status).toBe(404);
  });

  it('409s when engagement is not a reference-contact (no reference_contact_id)', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockServiceFrom.mockReturnValueOnce(
      chainSingle({ ...REFERENCE_CONTACT_ENGAGEMENT, reference_contact_id: null }),
    );
    const res = await closeReferenceContact(makeRequest({}), params);
    expect(res.status).toBe(409);
  });

  it('403s when caller is not a participant', async () => {
    mockRequireDomainUser.mockResolvedValueOnce({
      ok: true,
      value: {
        ...guardEmp().value,
        user: { id: 'stranger' },
        person: { id: 'stranger', identity_type: 'employer', current_hat: 'employer' },
      },
    });
    mockServiceFrom.mockReturnValueOnce(chainSingle(REFERENCE_CONTACT_ENGAGEMENT));
    const res = await closeReferenceContact(makeRequest({}), params);
    expect(res.status).toBe(403);
  });

  it('409s when engagement is already closed', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockServiceFrom.mockReturnValueOnce(
      chainSingle({ ...REFERENCE_CONTACT_ENGAGEMENT, status: 'closed' }),
    );
    const res = await closeReferenceContact(makeRequest({}), params);
    expect(res.status).toBe(409);
  });

  it('fires REFERENCE.CONTACT_THREAD_CLOSED on happy path', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardEmp());
    mockServiceFrom.mockReturnValueOnce(chainSingle(REFERENCE_CONTACT_ENGAGEMENT));
    const res = await closeReferenceContact(makeRequest({}), params);
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('REFERENCE.CONTACT_THREAD_CLOSED');
    expect(args.aggregateId).toBe('rc-1');
    expect(args.aggregateType).toBe('reference_contact');
    expect(args.payload).toEqual({ engagement_id: 'eng-1' });
  });
});
