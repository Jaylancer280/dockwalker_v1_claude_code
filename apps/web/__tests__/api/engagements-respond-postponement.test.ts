import { describe, it, expect, vi, beforeEach } from 'vitest';

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

function guardOk(userId = 'crew1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
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

const proposedEngagement = {
  id: 'e1',
  crew_person_id: 'crew1',
  employer_person_id: 'emp1',
  daywork_id: 'dw1',
  status: 'active',
  postponement_status: 'proposed',
  proposed_start_date: '2027-06-01',
  proposed_end_date: '2027-06-10',
  proposed_working_days: 5,
};

describe('POST /api/engagements/:id/respond-postponement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 200 with outcome accepted when crew approves and no overlap', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(proposedEngagement));
    mockCheckNoOverlapExcluding.mockResolvedValueOnce(true);

    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-postponement/route'
    );
    const res = await POST(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('accepted');

    expect(mockCheckNoOverlapExcluding).toHaveBeenCalledWith(
      expect.anything(),
      'crew1',
      '2027-06-01',
      '2027-06-10',
      'e1',
    );
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('ENGAGEMENT.POSTPONEMENT_ACCEPTED');
  });

  it('returns 200 with outcome rejected when crew rejects', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(proposedEngagement));

    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-postponement/route'
    );
    const res = await POST(makeRequest({ accepted: false }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('rejected');

    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('ENGAGEMENT.POSTPONEMENT_REJECTED');
    expect(events[1].eventType).toBe('MESSAGE.SENT');
  });

  it('returns 403 when user is not the crew member (employer hat)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth.mockReturnValueOnce(makeChain(proposedEngagement));

    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-postponement/route'
    );
    const res = await POST(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when no pending postponement proposal', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...proposedEngagement, postponement_status: null }),
    );

    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-postponement/route'
    );
    const res = await POST(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/pending/i);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...proposedEngagement, status: 'cancelled' }),
    );

    const { POST } = await import(
      '@/app/api/engagements/[id]/respond-postponement/route'
    );
    const res = await POST(makeRequest({ accepted: true }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not active/i);
  });
});
