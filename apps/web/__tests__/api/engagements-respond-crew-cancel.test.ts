import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/engagements/[id]/respond-crew-cancel/route';

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

const crewCancelledEngagement = {
  id: 'e1',
  employer_person_id: 'u1',
  daywork_id: 'd1',
  status: 'cancelled',
  cancelled_by: 'crew',
};

describe('POST /api/engagements/:id/respond-crew-cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...crewCancelledEngagement, employer_person_id: 'other' }),
    );

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement was not cancelled by crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...crewCancelledEngagement, cancelled_by: 'employer' }),
    );

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not cancelled by crew/);
  });

  it('returns 400 when engagement is not cancelled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ ...crewCancelledEngagement, status: 'active' }),
    );

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(crewCancelledEngagement));

    const res = await POST(makeRequest({ action: 'invalid' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/action/);
  });

  it('returns 400 when daywork is no longer in_progress', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(crewCancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'active', start_date: '2099-01-01' }));

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no longer available/);
  });

  it('returns 200 and relists when action=relist with future dates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(crewCancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'in_progress', start_date: '2099-01-01' }));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('relisted');

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('DAYWORK.RELISTED');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    expect(events[1].payload.is_system).toBe(true);
    expect(events[1].payload.content).toMatch(/relisted/);
  });

  it('returns 400 when relist requested but start date has passed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(crewCancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'in_progress', start_date: '2020-01-01' }));

    const res = await POST(makeRequest({ action: 'relist' }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start date/);
  });

  it('returns 200 and cancels daywork when action=cancel', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(crewCancelledEngagement))
      .mockReturnValueOnce(makeChain({ id: 'd1', status: 'in_progress', start_date: '2099-01-01' }));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await POST(makeRequest({ action: 'cancel' }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe('cancelled');

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[0].event_type).toBe('DAYWORK.CANCELLED_BY_EMPLOYER');
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    expect(events[1].payload.content).toMatch(/cancelled/);
  });
});
