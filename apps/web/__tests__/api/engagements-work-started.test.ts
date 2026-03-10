import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as workStarted } from '@/app/api/engagements/[id]/work-started/route';

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

function guardOk(userId = 'u1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: userId },
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
  crew_person_id: 'crew1',
  employer_person_id: 'emp1',
  daywork_id: 'd1',
  status: 'active',
  work_started_status: null,
};

describe('POST /api/engagements/:id/work-started', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not a participant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('stranger'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain({ ...activeEngagement, status: 'cancelled' }));
    const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when action is invalid', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await workStarted(makeRequest({ action: 'bogus' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  describe('initiate', () => {
    it('crew initiates work started', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
      mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
      mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch

      const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('initiated_by_crew');

      const events = mockRpc.mock.calls[0][1].p_events;
      expect(events[0].event_type).toBe('ENGAGEMENT.WORK_STARTED');
      expect(events[0].payload.initiated_by).toBe('crew');
    });

    it('employer initiates work started', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
      mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
      mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch

      const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('initiated_by_employer');
    });

    it('returns 400 when already initiated', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'initiated_by_employer' }),
      );
      const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
      expect(res.status).toBe(400);
    });

    it('returns 400 when already confirmed', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'confirmed' }),
      );
      const res = await workStarted(makeRequest({ action: 'initiate' }), makeParams('e1'));
      expect(res.status).toBe(400);
    });
  });

  describe('confirm', () => {
    it('employer confirms after crew initiation', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'initiated_by_crew' }),
      );
      mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch

      const res = await workStarted(makeRequest({ action: 'confirm' }), makeParams('e1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('confirmed');

      expect(mockRpc.mock.calls[0][1].p_events[0].event_type).toBe('ENGAGEMENT.WORK_STARTED_CONFIRMED');
    });

    it('crew confirms after employer initiation', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'initiated_by_employer' }),
      );
      mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null }); // batch

      const res = await workStarted(makeRequest({ action: 'confirm' }), makeParams('e1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('confirmed');
    });

    it('returns 400 when no initiation to confirm', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
      mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
      const res = await workStarted(makeRequest({ action: 'confirm' }), makeParams('e1'));
      expect(res.status).toBe(400);
    });

    it('returns 400 when already confirmed', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'confirmed' }),
      );
      const res = await workStarted(makeRequest({ action: 'confirm' }), makeParams('e1'));
      expect(res.status).toBe(400);
    });

    it('returns 400 when same party tries to confirm own initiation', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
      mockFromAuth.mockReturnValueOnce(
        makeChain({ ...activeEngagement, work_started_status: 'initiated_by_crew' }),
      );
      const res = await workStarted(makeRequest({ action: 'confirm' }), makeParams('e1'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('other party');
    });
  });
});
