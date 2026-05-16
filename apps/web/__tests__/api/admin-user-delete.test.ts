import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { DELETE } from '@/app/api/admin/users/[personId]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockLogAdminAction = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/admin/log-action', () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
}));

const mockSentryCapture = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockSentryCapture(...args),
}));

const mockAppendEvents = vi.fn().mockResolvedValue(['evt-1', 'evt-2']);
vi.mock('@dockwalker/db', () => ({
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

const mockCascadeBlock = vi.fn().mockResolvedValue({
  engagements_cancelled: 0,
  postings_hidden: 0,
  availability_cleared: false,
});
vi.mock('@/lib/admin/cascade-block', () => ({
  cascadeBlock: (...args: unknown[]) => mockCascadeBlock(...args),
}));

const mockFrom = vi.fn();
const mockUpdateUserById = vi.fn();
const mockGetUserById = vi.fn();
const mockDeleteUser = vi.fn();

function adminOk(adminId = 'admin-1') {
  return {
    ok: true,
    value: {
      user: { id: adminId },
      person: { id: adminId, identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: adminId },
      supabase: {},
      serviceClient: {
        from: mockFrom,
        auth: {
          admin: {
            updateUserById: mockUpdateUserById,
            getUserById: mockGetUserById,
            deleteUser: mockDeleteUser,
          },
        },
      },
    },
  };
}

// persons.select(...).eq(...).maybeSingle() chain
function personsMaybeSingle(result: { data: unknown; error?: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ error: null, ...result }),
      }),
    }),
  };
}

function makeParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

describe('DELETE /api/admin/users/:personId (scrub + ban / discard)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when admin tries to delete self', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk('admin-1'));
    const res = await DELETE(new Request('http://localhost'), makeParams('admin-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('own account');
  });

  it('returns 500 (not discard) when the persons lookup errors — never discard on a flaky read', async () => {
    // R8 guard: the discard branch deletes the auth user irreversibly.
    // A transient persons-query failure must NOT be mistaken for
    // "no persons row → safe to discard".
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(
      personsMaybeSingle({ data: null, error: { message: 'connection reset' } }),
    );
    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(500);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('returns 404 when neither persons row nor auth user exists', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(personsMaybeSingle({ data: null }));
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE(new Request('http://localhost'), makeParams('u-missing'));
    expect(res.status).toBe(404);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('discards an auth-only signup (no persons row) without scrub or ledger writes', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(personsMaybeSingle({ data: null }));
    mockGetUserById.mockResolvedValue({
      data: { user: { id: 'u-incomplete', email: 'bob@gmail.com' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });

    const res = await DELETE(new Request('http://localhost'), makeParams('u-incomplete'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discarded).toBe(true);

    expect(mockDeleteUser).toHaveBeenCalledWith('u-incomplete');
    // No scrub, no cascade, no ledger writes for an auth-only signup.
    expect(mockCascadeBlock).not.toHaveBeenCalled();
    expect(mockAppendEvents).not.toHaveBeenCalled();
    // Audit logged with the new action + null target (no persons FK).
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'discard_incomplete_signup',
        targetPersonId: null,
      }),
    );
  });

  it('returns 500 when auth.admin.deleteUser fails on discard', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(personsMaybeSingle({ data: null }));
    mockGetUserById.mockResolvedValue({
      data: { user: { id: 'u-incomplete', email: 'bob@gmail.com' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: { message: 'auth down' } });

    const res = await DELETE(new Request('http://localhost'), makeParams('u-incomplete'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('auth down');
  });

  it('returns 400 when trying to delete an admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(personsMaybeSingle({ data: { id: 'u1', is_admin: true } }));
    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('admin account');
  });

  it('scrubs user, cascades block, and bans auth row on success', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(
      personsMaybeSingle({ data: { id: 'u1', is_admin: false, blocked_at: null } }),
    );
    mockUpdateUserById.mockResolvedValue({ error: null });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);

    expect(mockCascadeBlock).toHaveBeenCalledWith(expect.anything(), 'u1', 'admin-1', {
      reasonText: 'Account deleted by DockWalker',
    });
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('PERSON.DATA_SCRUBBED');
    expect(events[1].eventType).toBe('PERSON.DEACTIVATED');
    expect(mockUpdateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' });
  });

  it('still returns 200 when auth ban fails — scrub already committed, ban is best-effort', async () => {
    // Regression guard (Stage 236): previously returned 500, leaving the
    // admin dashboard stale on a user whose PERSON.DATA_SCRUBBED +
    // PERSON.DEACTIVATED had already committed irreversibly. The auth-side
    // ban is defence-in-depth; a failure now goes to Sentry.
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue(
      personsMaybeSingle({ data: { id: 'u1', is_admin: false, blocked_at: null } }),
    );
    const banError = { message: 'Auth error' };
    mockUpdateUserById.mockResolvedValue({ error: banError });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);

    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    expect(mockSentryCapture).toHaveBeenCalledWith(
      banError,
      expect.objectContaining({
        tags: expect.objectContaining({
          module: 'admin.delete-user',
          step: 'auth_ban',
        }),
      }),
    );
  });
});
