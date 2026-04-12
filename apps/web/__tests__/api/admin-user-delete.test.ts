import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { DELETE } from '@/app/api/admin/users/[personId]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockFrom = vi.fn();
const mockRpc = vi.fn();
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
        rpc: mockRpc,
        auth: { admin: { deleteUser: mockDeleteUser } },
      },
    },
  };
}

function makeParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

describe('DELETE /api/admin/users/:personId', () => {
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

  it('deletes user data and auth record on success', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
        }),
      }),
    });
    mockRpc.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('admin_delete_person', { target_id: 'u1' });
    expect(mockDeleteUser).toHaveBeenCalledWith('u1');
  });

  it('returns 500 when RPC fails', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
        }),
      }),
    });
    mockRpc.mockResolvedValue({ error: { message: 'FK violation' } });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(500);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('returns 500 when auth delete fails after RPC succeeds', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
        }),
      }),
    });
    mockRpc.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: { message: 'Auth error' } });

    const res = await DELETE(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('auth record');
  });
});
