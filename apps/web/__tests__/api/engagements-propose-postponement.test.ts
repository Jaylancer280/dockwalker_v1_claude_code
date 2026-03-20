import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvents = vi.fn().mockResolvedValue(['ev1', 'ev2']);
const mockCheckNoOverlapExcluding = vi.fn();
vi.mock('@dockwalker/db', () => ({
  appendEvent: vi.fn(),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
  checkNoOverlapExcluding: (...args: unknown[]) => mockCheckNoOverlapExcluding(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFromAuth = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk(userId = 'u1') {
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

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const activeEngagement = {
  id: 'e1',
  crew_person_id: 'crew1',
  employer_person_id: 'u1',
  daywork_id: 'dw1',
  status: 'active',
  postponement_status: null,
  work_started_status: null,
};

const validBody = {
  start_date: '2027-06-01',
  end_date: '2027-06-10',
  working_days: 5,
};

describe('POST /api/engagements/:id/propose-postponement', () => {
  let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockAppendEvents.mockResolvedValue(['ev1', 'ev2']);

    const mod = await import('@/app/api/engagements/[id]/propose-postponement/route');
    POST = mod.POST;
  });

  it('happy path — employer proposes new dates, returns 200 with outcome proposed', async () => {
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockCheckNoOverlapExcluding.mockResolvedValueOnce(true);

    const res = await POST(makeRequest(validBody), makeParams('e1'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('proposed');
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    // Verify the first event is the postponement proposal
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('ENGAGEMENT.POSTPONEMENT_PROPOSED');
    expect(events[1].eventType).toBe('MESSAGE.SENT');
  });

  it('returns 403 when user has crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        user: { id: 'u1' },
        person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
        profile: { person_id: 'u1' },
        supabase: { from: mockFromAuth },
        serviceClient: { rpc: vi.fn() },
      },
    });
    // Employer check will fail because employer_person_id !== user.id
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, employer_person_id: 'someone_else' }),
    );

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not the engagement employer', async () => {
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, employer_person_id: 'other_employer' }),
    );

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, status: 'cancelled' }),
    );

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when work has already started (confirmed)', async () => {
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, work_started_status: 'confirmed' }),
    );

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('work has started');
  });

  it('returns 400 when postponement already proposed (once-only)', async () => {
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...activeEngagement, postponement_status: 'proposed' }),
    );

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('once');
  });

  it('returns 200 with outcome conflict when proposed dates overlap and no confirmConflict', async () => {
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockCheckNoOverlapExcluding.mockResolvedValueOnce(false);

    const res = await POST(makeRequest(validBody), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('conflict');
    // No events should have been appended
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it('returns 200 with outcome conflict_confirmed when overlap and confirm_conflict true', async () => {
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockCheckNoOverlapExcluding.mockResolvedValueOnce(false);

    const res = await POST(
      makeRequest({ ...validBody, confirm_conflict: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('conflict_confirmed');
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    // Should cancel engagement and relist
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('ENGAGEMENT.CANCELLED_BY_EMPLOYER');
    expect(events[1].eventType).toBe('DAYWORK.RELISTED');
    expect(events[2].eventType).toBe('MESSAGE.SENT');
  });
});
