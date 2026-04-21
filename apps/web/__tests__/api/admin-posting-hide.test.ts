import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as hidePosting } from '@/app/api/admin/postings/[id]/hide/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockServiceFrom = vi.fn();

function adminGuard() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: 'admin-1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/postings/p-1/hide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function postingRow(status: string) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'p-1', status },
          error: null,
        }),
      }),
    }),
  };
}

describe('POST /api/admin/postings/:id/hide', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await hidePosting(
      req({ posting_type: 'daywork', reason: 'test' }),
      params('p-1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid posting_type', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await hidePosting(
      req({ posting_type: 'vessel', reason: 'test' }),
      params('p-1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing reason', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await hidePosting(req({ posting_type: 'daywork', reason: '' }), params('p-1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when posting missing', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await hidePosting(
      req({ posting_type: 'daywork', reason: 'test' }),
      params('p-1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when daywork already cancelled', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(postingRow('cancelled'));
    const res = await hidePosting(
      req({ posting_type: 'daywork', reason: 'test' }),
      params('p-1'),
    );
    expect(res.status).toBe(400);
  });

  it('emits ADMIN.POSTING_HIDDEN for active daywork', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(postingRow('active'));
    const res = await hidePosting(
      req({ posting_type: 'daywork', reason: 'fraud report' }),
      params('p-1'),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const call = mockAppendEvent.mock.calls[0][1];
    expect(call.eventType).toBe('ADMIN.POSTING_HIDDEN');
    expect(call.payload.posting_type).toBe('daywork');
    expect(call.payload.posting_id).toBe('p-1');
    expect(call.payload.admin_person_id).toBe('admin-1');
  });

  it('emits ADMIN.POSTING_HIDDEN for in_negotiation permanent', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(postingRow('in_negotiation'));
    const res = await hidePosting(
      req({ posting_type: 'permanent', reason: 'spam' }),
      params('p-1'),
    );
    expect(res.status).toBe(200);
    const call = mockAppendEvent.mock.calls[0][1];
    expect(call.payload.posting_type).toBe('permanent');
  });
});
