import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/applicants/[crewId]/reject/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
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
      serviceClient: { from: mockFromAuth, rpc: vi.fn() },
    },
  };
}

const params = Promise.resolve({ id: 'pp1', crewId: 'c1' });
const req = new Request('http://localhost', { method: 'POST' });

describe('POST /api/permanent/:id/applicants/:crewId/reject', () => {
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

  it('returns 400 when application is in terminal state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1' } }) }) }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'selected' } }) }) }) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('happy path — rejects applicant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1' } }) }) }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'applied' } }) }) }) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.REJECTED');
  });
});
