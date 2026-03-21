import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/cancel/route';

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

describe('POST /api/permanent/:id/cancel', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAppendEvent.mockResolvedValue('ev1'); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({ ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it('returns 403 when not posting owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'other', status: 'active' } }) }) }) });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    expect((await POST(req, { params })).status).toBe(404);
  });

  it('returns 400 when posting status is filled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'filled' } }) }) }) });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it('happy path — cancels active posting', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active' } }) }) }) });
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Changed plans' }) });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.CANCELLED_BY_EMPLOYER');
    expect(mockAppendEvent.mock.calls[0][1].payload.reason).toBe('Changed plans');
  });

  it('happy path — cancels in_negotiation posting', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'in_negotiation' } }) }) }) });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.CANCELLED_BY_EMPLOYER');
  });
});
