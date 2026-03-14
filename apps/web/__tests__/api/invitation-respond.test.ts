import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/invitations/[id]/respond/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
const mockAppendEvents = vi.fn().mockResolvedValue(['evt-1', 'evt-2']);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
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

const pendingInvitation = {
  id: 'inv-1',
  daywork_id: 'dw-1',
  crew_person_id: 'u1',
  status: 'pending',
};

describe('POST /api/daywork/invitations/:id/respond', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accept: creates application and updates invitation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ id: 'dw-1', status: 'active' });
    mockAvailability([{ id: 'aw-1' }]);

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application.status).toBe('applied');
    expect(mockAppendEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'DAYWORK.INVITATION_ACCEPTED' }),
        expect.objectContaining({ eventType: 'DAYWORK.APPLIED' }),
      ]),
    );
  });

  it('accept: returns 400 if daywork no longer active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ id: 'dw-1', status: 'in_progress' });

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no longer available');
  });

  it('accept: returns 400 if crew has no availability', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ id: 'dw-1', status: 'active' });
    mockAvailability([]);

    const res = await POST(makeReq({ action: 'accept' }), makeParams('inv-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('availability');
  });

  it('decline: updates invitation status', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockInvitation(pendingInvitation);
    mockDaywork({ id: 'dw-1', status: 'active' });

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
});
