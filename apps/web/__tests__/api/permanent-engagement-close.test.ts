import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/engagements/[id]/close/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({ requireDomainUser: (...a: unknown[]) => mockRequireDomainUser(...a) }));
const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({ appendEvent: (...a: unknown[]) => mockAppendEvent(...a) }));
vi.mock('@/lib/push-triggers', () => ({ notifyOnEvent: vi.fn() }));

const mockFrom = vi.fn();
function guardOk(userId = 'crew1') {
  return { ok: true, value: { user: { id: userId }, person: { id: userId, current_hat: 'crew' }, profile: {}, supabase: { from: mockFrom }, serviceClient: { from: vi.fn(), rpc: vi.fn() } } };
}
const params = Promise.resolve({ id: 'eng1' });

function makeEngChain(data: unknown) {
  const inner = { not: vi.fn(), single: vi.fn().mockResolvedValue({ data }) };
  inner.not.mockReturnValue(inner);
  return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(inner) }) };
}

describe('POST /api/permanent/engagements/:id/close', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAppendEvent.mockResolvedValue('ev1'); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({ ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
    const req = new Request('http://localhost', { method: 'POST', body: '{}' });
    expect((await POST(req, { params })).status).toBe(401);
  });

  it('returns 403 when not a participant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('outsider'));
    mockFrom.mockReturnValueOnce(makeEngChain({ id: 'eng1', crew_person_id: 'crew1', employer_person_id: 'emp1', permanent_posting_id: 'pp1', status: 'active' }));
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'withdrew' }) });
    expect((await POST(req, { params })).status).toBe(403);
  });

  it('returns 400 when engagement already closed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFrom.mockReturnValueOnce(makeEngChain({ id: 'eng1', crew_person_id: 'crew1', employer_person_id: 'emp1', permanent_posting_id: 'pp1', status: 'closed' }));
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'withdrew' }) });
    expect((await POST(req, { params })).status).toBe(400);
  });

  it('returns 404 when not a permanent engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFrom.mockReturnValueOnce(makeEngChain(null)); // .not('permanent_posting_id', 'is', null) filters it out
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'withdrew' }) });
    expect((await POST(req, { params })).status).toBe(404);
  });

  it('happy path — crew closes with withdrew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFrom.mockReturnValueOnce(makeEngChain({ id: 'eng1', crew_person_id: 'crew1', employer_person_id: 'emp1', permanent_posting_id: 'pp1', status: 'active' }));
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'withdrew' }) });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.ENGAGEMENT_CLOSED');
    expect(mockAppendEvent.mock.calls[0][1].payload.closed_by).toBe('crew');
    expect(mockAppendEvent.mock.calls[0][1].payload.outcome).toBe('withdrew');
  });

  it('happy path — employer closes with successful_placement', async () => {
    mockRequireDomainUser.mockResolvedValue({ ok: true, value: { user: { id: 'emp1' }, person: { id: 'emp1', current_hat: 'employer' }, profile: {}, supabase: { from: mockFrom }, serviceClient: { from: vi.fn(), rpc: vi.fn() } } });
    mockFrom.mockReturnValueOnce(makeEngChain({ id: 'eng1', crew_person_id: 'crew1', employer_person_id: 'emp1', permanent_posting_id: 'pp1', status: 'active' }));
    const req = new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: 'successful_placement' }) });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].payload.closed_by).toBe('employer');
    expect(mockAppendEvent.mock.calls[0][1].payload.outcome).toBe('successful_placement');
  });
});
