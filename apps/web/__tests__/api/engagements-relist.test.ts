import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as relistWithDates } from '@/app/api/engagements/[id]/relist-with-dates/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
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

function makeRequest() {
  return new Request('http://localhost', { method: 'POST' });
}

const cancelledEngagement = {
  id: 'e1',
  employer_person_id: 'u1',
  daywork_id: 'd1',
  status: 'cancelled',
  postponement_status: 'rejected',
  proposed_start_date: '2099-07-01',
  proposed_end_date: '2099-07-10',
  proposed_working_days: 5,
};

describe('POST /api/engagements/:id/relist-with-dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...cancelledEngagement, employer_person_id: 'other' }),
    );
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not cancelled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...cancelledEngagement, status: 'active' }),
    );
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when postponement_status is not rejected', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...cancelledEngagement, postponement_status: 'proposed' }),
    );
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when daywork is already active (relisted)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(cancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'active' }));
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when daywork is completed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(cancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'completed' }));
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when daywork is cancelled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(cancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'cancelled' }));
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('successfully relists with proposed dates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(cancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'in_progress' }));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch (relist + msg)

    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DAYWORK.RELISTED event was emitted with proposed dates
    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('DAYWORK.RELISTED');
    expect(events[0].payload.start_date).toBe('2099-07-01');
    expect(events[0].payload.end_date).toBe('2099-07-10');
    expect(events[0].payload.working_days).toBe(5);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    const res = await relistWithDates(makeRequest(), makeParams('e1'));
    expect(res.status).toBe(404);
  });
});
