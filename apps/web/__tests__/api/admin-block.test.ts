import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as blockUser } from '@/app/api/admin/users/[personId]/block/route';
import { POST as unblockUser } from '@/app/api/admin/users/[personId]/unblock/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock('@/lib/admin/log-action', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

const mockCascadeBlock = vi.fn().mockResolvedValue({
  engagements_cancelled: 0,
  postings_hidden: 0,
  availability_cleared: false,
});
vi.mock('@/lib/admin/cascade-block', () => ({
  cascadeBlock: (...args: unknown[]) => mockCascadeBlock(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockServiceFrom = vi.fn();
const mockServiceAuth = {
  admin: { updateUserById: vi.fn() },
};

function adminOk() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: 'admin-1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom, auth: mockServiceAuth },
    },
  };
}

function makeParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

function blockRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/users/target-1/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function unblockRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/users/target-1/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/users/:personId/block', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await blockUser(
      blockRequest({ reason_category: 'spam', reason_text: 'test' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on self-block', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await blockUser(
      blockRequest({ reason_category: 'spam', reason_text: 'test' }),
      makeParams('admin-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Cannot block your own');
  });

  it('returns 400 on admin-on-admin block', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const personChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'target-1', is_admin: true, blocked_at: null },
        error: null,
      }),
    };
    mockServiceFrom.mockReturnValue(personChain);
    const res = await blockUser(
      blockRequest({ reason_category: 'spam', reason_text: 'test' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Cannot block an admin');
  });

  it('returns 400 for invalid reason_category', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await blockUser(
      blockRequest({ reason_category: 'invalid', reason_text: 'test' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for already blocked user', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const personChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'target-1', is_admin: false, blocked_at: '2026-01-01' },
        error: null,
      }),
    };
    mockServiceFrom.mockReturnValue(personChain);
    const res = await blockUser(
      blockRequest({ reason_category: 'spam', reason_text: 'test' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already blocked');
  });

  it('blocks user and returns cascade summary', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'target-1', is_admin: false, blocked_at: null },
        error: null,
      }),
    });

    const res = await blockUser(
      blockRequest({ reason_category: 'harassment', reason_text: 'Abusive messages' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCascadeBlock).toHaveBeenCalledWith(
      expect.anything(),
      'target-1',
      'admin-1',
      { reasonCategory: 'harassment', reasonText: 'Abusive messages' },
    );
  });
});

describe('POST /api/admin/users/:personId/unblock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await unblockUser(
      unblockRequest({ reason_text: 'test' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing reason_text', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await unblockUser(
      unblockRequest({}),
      makeParams('target-1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when user is not blocked', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const personChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'target-1', blocked_at: null },
        error: null,
      }),
    };
    mockServiceFrom.mockReturnValue(personChain);
    const res = await unblockUser(
      unblockRequest({ reason_text: 'Mistake' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not blocked');
  });

  it('unblocks user successfully', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const personChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'target-1', blocked_at: '2026-04-01' },
        error: null,
      }),
    };
    mockServiceFrom.mockReturnValue(personChain);
    const res = await unblockUser(
      unblockRequest({ reason_text: 'False positive, user is legitimate' }),
      makeParams('target-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('ADMIN.USER_UNBLOCKED');
  });
});
