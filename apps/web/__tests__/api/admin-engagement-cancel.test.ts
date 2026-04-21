import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as cancelEngagement } from '@/app/api/admin/engagements/[id]/cancel/route';

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
  return new Request('http://localhost/api/admin/engagements/eng-1/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function engagementRow(status: string, postingType: 'daywork' | 'permanent') {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'eng-1',
            daywork_id: postingType === 'daywork' ? 'dw-1' : null,
            permanent_posting_id: postingType === 'permanent' ? 'pp-1' : null,
            status,
          },
          error: null,
        }),
      }),
    }),
  };
}

describe('POST /api/admin/engagements/:id/cancel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await cancelEngagement(
      req({ reason_category: 'fraud', reason_text: 'test' }),
      params('eng-1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid reason_category', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await cancelEngagement(
      req({ reason_category: 'not_a_real_category', reason_text: 'test' }),
      params('eng-1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on empty reason_text', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await cancelEngagement(
      req({ reason_category: 'fraud', reason_text: '   ' }),
      params('eng-1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when engagement missing', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await cancelEngagement(
      req({ reason_category: 'fraud', reason_text: 'test' }),
      params('eng-1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when engagement not active', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(engagementRow('completed', 'daywork'));
    const res = await cancelEngagement(
      req({ reason_category: 'fraud', reason_text: 'test' }),
      params('eng-1'),
    );
    expect(res.status).toBe(400);
  });

  it('emits ADMIN.ENGAGEMENT_CANCELLED for daywork engagement', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(engagementRow('active', 'daywork'));
    const res = await cancelEngagement(
      req({ reason_category: 'safety_concern', reason_text: 'reports' }),
      params('eng-1'),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const call = mockAppendEvent.mock.calls[0][1];
    expect(call.eventType).toBe('ADMIN.ENGAGEMENT_CANCELLED');
    expect(call.payload.posting_type).toBe('daywork');
    expect(call.payload.daywork_id).toBe('dw-1');
    expect(call.payload.admin_person_id).toBe('admin-1');
  });

  it('emits ADMIN.ENGAGEMENT_CANCELLED for permanent engagement', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue(engagementRow('active', 'permanent'));
    const res = await cancelEngagement(
      req({ reason_category: 'fraud', reason_text: 'duplicate account' }),
      params('eng-1'),
    );
    expect(res.status).toBe(200);
    const call = mockAppendEvent.mock.calls[0][1];
    expect(call.payload.posting_type).toBe('permanent');
    expect(call.payload.permanent_posting_id).toBe('pp-1');
  });
});
