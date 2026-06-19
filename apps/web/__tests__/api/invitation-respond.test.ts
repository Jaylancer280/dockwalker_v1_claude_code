import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/invitations/[id]/respond/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFromAuth = vi.fn();
const mockServiceRpc = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockServiceRpc, from: mockServiceFrom },
      ...overrides,
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeReq = (body: Record<string, unknown>) =>
  new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

function mockInvitation(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockDaywork(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockAvailability(data: Record<string, unknown>[]) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data }),
          }),
        }),
      }),
    }),
  });
}

function mockEngagementFetch(engagementId: string | null) {
  mockServiceFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: engagementId ? { id: engagementId } : null,
            }),
          }),
        }),
      }),
    }),
  });
}

const pendingInvitation = {
  id: 'inv-1',
  daywork_id: 'dw-1',
  crew_person_id: 'u1',
  status: 'pending',
};

const activeDaywork = {
  id: 'dw-1',
  status: 'active',
  start_date: '2099-01-01',
  end_date: '2099-01-05',
  positions_filled: 0,
  positions_available: 1,
  poster_person_id: 'employer-1',
};

describe('POST /api/daywork/invitations/:id/respond', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceFrom.mockReset();
  });

  it('accept: creates engagement directly (no application)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork(activeDaywork);
    mockAvailability([{ id: 'aw-1' }]);
    mockServiceRpc.mockResolvedValueOnce({ data: true, error: null });
    mockEngagementFetch('eng-1');

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.engagementId).toBe('eng-1');
    // Only one event — INVITATION_ACCEPTED (no APPLIED)
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'DAYWORK.INVITATION_ACCEPTED',
        payload: expect.objectContaining({
          crew_person_id: 'u1',
          employer_person_id: 'employer-1',
          start_date: '2099-01-01',
          end_date: '2099-01-05',
        }),
      }),
    );
  });

  it('accept: returns 409 when positions full', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ ...activeDaywork, positions_filled: 1, positions_available: 1 });
    mockAvailability([{ id: 'aw-1' }]);
    mockServiceRpc.mockResolvedValueOnce({ data: true, error: null });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('position_filled');
  });

  it('accept: returns 400 if daywork no longer active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ ...activeDaywork, status: 'in_progress' });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no longer available');
  });

  it('accept: returns 400 if crew has no availability', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork(activeDaywork);
    mockAvailability([]);

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('availability');
  });

  it('decline: updates invitation status', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork(activeDaywork);

    const res = await POST(makeReq({ action: 'decline' }), makeParams('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'DAYWORK.INVITATION_DECLINED' }),
    );
  });

  it('returns 403 if not the invited crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation({ ...pendingInvitation, crew_person_id: 'other-user' });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 if invitation not pending', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation({ ...pendingInvitation, status: 'declined' });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no longer pending');
  });

  it('returns 403 if not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid action', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeReq({ action: 'maybe' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
  });

  it('accept: returns 409 if crew has overlapping engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork(activeDaywork);
    mockAvailability([{ id: 'aw-1' }]);
    mockServiceRpc.mockResolvedValueOnce({ data: false, error: null });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('overlapping engagement');
  });

  it('accept: returns 400 if daywork start date has passed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ ...activeDaywork, start_date: '2020-01-01' });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already started');
  });
});
