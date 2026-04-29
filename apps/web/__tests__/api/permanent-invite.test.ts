import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/invite/route';

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

const mockQrLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getQrHireLimit: () => ({ limit: mockQrLimit }),
}));

const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/permanent/post-1/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function singleChain(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data });
  self.maybeSingle = vi.fn().mockResolvedValue({ data });
  return self;
}

function guardOk(hat: 'employer' | 'agent' | 'crew' = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: 'employer-1' },
      person: { id: 'employer-1', identity_type: 'crew', current_hat: hat },
      profile: { person_id: 'employer-1' },
      supabase: { from: mockSupabaseFrom },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

const POSTING = {
  id: 'post-1',
  status: 'active',
  employer_person_id: 'employer-1',
  role_id: 'r1',
  vessel_id: 'v1',
};

const ACTIVE_CREW = {
  id: 'crew-1',
  identity_type: 'crew',
  deactivated_at: null,
  blocked_at: null,
};

describe('POST /api/permanent/[id]/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQrLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 1000 });
    mockRequireDomainUser.mockResolvedValue(guardOk('employer'));
  });

  it('403s for crew hat', async () => {
    mockRequireDomainUser.mockResolvedValueOnce(guardOk('crew'));
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(403);
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('400s when crewPersonId is missing', async () => {
    const res = await POST(makeRequest({}), makeParams('post-1'));
    expect(res.status).toBe(400);
  });

  it('400s when message exceeds 500 chars', async () => {
    const res = await POST(
      makeRequest({ crewPersonId: 'crew-1', message: 'a'.repeat(501) }),
      makeParams('post-1'),
    );
    expect(res.status).toBe(400);
  });

  it('404s when posting does not exist', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(null));
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(404);
  });

  it('403s when caller is not the posting employer', async () => {
    mockSupabaseFrom.mockReturnValueOnce(
      singleChain({ ...POSTING, employer_person_id: 'someone-else' }),
    );
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(403);
  });

  it('400s when posting status is not active', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain({ ...POSTING, status: 'in_negotiation' }));
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(400);
  });

  it('404s when target crew is missing or wrong identity_type', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(singleChain(null));
    const res = await POST(makeRequest({ crewPersonId: 'missing' }), makeParams('post-1'));
    expect(res.status).toBe(404);
  });

  it('400s when target crew is deactivated', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(
      singleChain({ ...ACTIVE_CREW, deactivated_at: '2026-01-01' }),
    );
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(400);
  });

  it('429s when QR-hire limit fires', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(singleChain(ACTIVE_CREW));
    mockQrLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 1000 });
    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(429);
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('fires PERMANENT.INVITED with all required payload fields and 201s', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(singleChain(ACTIVE_CREW));

    const res = await POST(
      makeRequest({ crewPersonId: 'crew-1', message: 'Hi Sophie' }),
      makeParams('post-1'),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invitation.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.eventType).toBe('PERMANENT.INVITED');
    expect(args.aggregateType).toBe('permanent_invitation');
    expect(args.payload.permanent_posting_id).toBe('post-1');
    expect(args.payload.crew_person_id).toBe('crew-1');
    expect(args.payload.message).toBe('Hi Sophie');
    expect(args.personId).toBe('employer-1');
  });

  it('omits message from payload when empty string', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(singleChain(ACTIVE_CREW));

    await POST(makeRequest({ crewPersonId: 'crew-1', message: '' }), makeParams('post-1'));
    const args = mockAppendEvent.mock.calls[0]![1];
    expect(args.payload.message).toBeUndefined();
  });

  it('maps unique_violation (23505) to 409 with spec copy', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(singleChain(ACTIVE_CREW));
    mockAppendEvent.mockRejectedValueOnce(new Error('append_event failed: 23505 unique_violation'));

    const res = await POST(makeRequest({ crewPersonId: 'crew-1' }), makeParams('post-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already invited/i);
  });
});
