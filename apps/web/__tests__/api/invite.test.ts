import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/invite/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
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

const baseDaywork = {
  id: 'd1',
  poster_person_id: 'u1',
  status: 'active',
};

// Helpers for sequential mock chain
function mockDaywork(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockProfile(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockExistingApp(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  });
}

function mockExistingInvite(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  });
}

function mockInvitationCount(count: number) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count }),
      }),
    }),
  });
}

describe('POST /api/daywork/:id/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates invitation and returns 201', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockProfile({ person_id: 'c1' });
    mockExistingApp(null);
    mockExistingInvite(null);
    mockInvitationCount(0);

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invitation.status).toBe('pending');
    expect(body.invitation.id).toBeDefined();
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'DAYWORK.INVITED',
        aggregateType: 'invitation',
        payload: { daywork_id: 'd1', crew_person_id: 'c1' },
      }),
    );
  });

  it('returns 400 when invitation limit (2) reached', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockProfile({ person_id: 'c1' });
    mockExistingApp(null);
    mockExistingInvite(null);
    mockInvitationCount(2);

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('limit');
  });

  it('returns 400 if crew already applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockProfile({ person_id: 'c1' });
    mockExistingApp({ id: 'app-1' });

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already applied');
  });

  it('returns 400 if crew already invited', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockProfile({ person_id: 'c1' });
    mockExistingApp(null);
    mockExistingInvite({ id: 'inv-1' });

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already been invited');
  });

  it('returns 403 if not employer hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' } }),
    );

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 if daywork not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork({ ...baseDaywork, status: 'completed' });

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no longer active');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeReq({ crewPersonId: 'c1' }), makeParams('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 if crewPersonId missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(makeReq({}), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('crewPersonId');
  });
});
