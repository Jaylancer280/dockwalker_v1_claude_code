import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/applicants/[crewId]/shortlist/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: vi.fn().mockResolvedValue({ ok: true, plan: 'employer_pro' }),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'emp1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, current_hat: 'employer' },
      profile: {},
      supabase: { from: mockFromAuth },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

const params = Promise.resolve({ id: 'pp1', crewId: 'c1' });
const req = new Request('http://localhost', { method: 'POST' });

describe('POST /api/permanent/:id/applicants/:crewId/shortlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppendEvent.mockResolvedValue('ev1');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 when application status is not applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Posting
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active', shortlist_cap: 5 } }) }) }),
    });
    // Application — already shortlisted
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'shortlisted' } }) }) }) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when shortlist is at cap', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active', shortlist_cap: 2 } }) }) }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'applied' } }) }) }) }),
    });
    // Count query — at cap
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ count: 2 }) }) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('full');
  });

  it('happy path — shortlists applicant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active', shortlist_cap: 5 } }) }) }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'applied' } }) }) }) }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ count: 1 }) }) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.SHORTLISTED');
  });
});
