import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { DELETE } from '@/app/api/admin/users/[personId]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
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
        auth: { admin: { updateUserById: mockUpdateUserById } },
      },
    },
  };
}

function makeParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

describe('DELETE /api/admin/users/:personId (scrub + ban)', () => {
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

  it('returns 404 when user not found', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await DELETE(new Request('http://localhost'), makeParams('u-missing'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to delete an admin', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1', is_admin: true } }),
        }),
      }),
    });
    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('admin account');
  });

  it('scrubs user, cascades block, and bans auth row on success', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1', is_admin: false, blocked_at: null } }),
        }),
      }),
    });
    mockUpdateUserById.mockResolvedValue({ error: null });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);

    expect(mockCascadeBlock).toHaveBeenCalledWith(
      expect.anything(), 'u1', 'admin-1',
      { reasonText: 'Account deleted by DockWalker' },
    );
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events[0].eventType).toBe('PERSON.DATA_SCRUBBED');
    expect(events[1].eventType).toBe('PERSON.DEACTIVATED');
    expect(mockUpdateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' });
  });

  it('returns 500 when auth ban fails', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1', is_admin: false, blocked_at: null } }),
        }),
      }),
    });
    mockUpdateUserById.mockResolvedValue({ error: { message: 'Auth error' } });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('auth ban failed');
  });
});
