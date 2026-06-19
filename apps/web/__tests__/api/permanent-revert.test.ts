import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/revert/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({ requireDomainUser: (...a: unknown[]) => mockRequireDomainUser(...a) }));
const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({ appendEvent: (...a: unknown[]) => mockAppendEvent(...a) }));
vi.mock('@/lib/push-triggers', () => ({ notifyOnEvent: vi.fn() }));

const mockFrom = vi.fn();
function guardOk(userId = 'emp1') {
  return { ok: true, value: { user: { id: userId }, person: { id: userId, current_hat: 'employer' }, profile: {}, supabase: { from: mockFrom }, serviceClient: { from: vi.fn(), rpc: vi.fn() } } };
}
const params = Promise.resolve({ id: 'pp1' });
const req = new Request('http://localhost', { method: 'POST' });

describe('POST /api/permanent/:id/revert', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAppendEvent.mockResolvedValue('ev1'); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({ ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it('returns 400 when posting status is not in_negotiation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active' } }) }) }) });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it('returns 400 when no active engagement found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'in_negotiation' } }) }) }) });
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }) }) }) });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it('happy path — reverts selection', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'in_negotiation' } }) }) }) });
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'eng1' } }) }) }) }) });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.SELECTION_REVERTED');
  });
});
