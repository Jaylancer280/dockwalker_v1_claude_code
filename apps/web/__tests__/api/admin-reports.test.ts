import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as listAdminReports } from '@/app/api/admin/reports/route';
import {
  GET as getAdminReport,
  PATCH as patchAdminReport,
} from '@/app/api/admin/reports/[id]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
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

function listReq(qs: string = '') {
  return new Request(`http://localhost/api/admin/reports${qs ? `?${qs}` : ''}`);
}

function detailParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchReq(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/reports/r-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await listAdminReports(listReq());
    expect(res.status).toBe(403);
  });

  it('prioritises safety_concern rows over others of the same age', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const rows = [
      {
        id: 'r-old-safety',
        reporter_person_id: 'u1',
        reported_person_id: 'u2',
        engagement_id: null,
        reason_category: 'safety_concern',
        reason_text: 'x',
        status: 'open',
        resolution: null,
        admin_notes: null,
        admin_person_id: null,
        created_at: '2026-04-20T10:00:00Z',
        resolved_at: null,
        reporter: { display_name: 'Alice' },
        reported: { display_name: 'Bob' },
      },
      {
        id: 'r-new-spam',
        reporter_person_id: 'u3',
        reported_person_id: 'u4',
        engagement_id: null,
        reason_category: 'spam',
        reason_text: 'y',
        status: 'open',
        resolution: null,
        admin_notes: null,
        admin_person_id: null,
        created_at: '2026-04-21T10:00:00Z',
        resolved_at: null,
        reporter: { display_name: 'Carl' },
        reported: { display_name: 'Dee' },
      },
    ];
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: rows, error: null, count: 2 }),
          }),
        }),
      }),
    });
    const res = await listAdminReports(listReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports[0].id).toBe('r-old-safety');
    expect(body.reports[0].reporter_name).toBe('Alice');
    expect(body.total).toBe(2);
  });

  it('applies status filter', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const inMock = vi.fn();
    const orderMock = vi.fn();
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
    inMock.mockReturnValue({
      order: orderMock.mockReturnValue({
        order: vi.fn().mockReturnValue({ range: rangeMock }),
      }),
    });
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inMock }),
    });
    await listAdminReports(listReq('status=open,reviewing'));
    expect(inMock).toHaveBeenCalledWith('status', ['open', 'reviewing']);
  });
});

describe('GET /api/admin/reports/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when not found', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await getAdminReport(new Request('http://localhost'), detailParams('r-1'));
    expect(res.status).toBe(404);
  });

  it('returns the report detail', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const row = {
      id: 'r-1',
      reporter_person_id: 'u1',
      reported_person_id: 'u2',
      engagement_id: 'eng-1',
      reason_category: 'harassment',
      reason_text: 'detail',
      status: 'open',
      resolution: null,
      admin_notes: null,
      admin_person_id: null,
      created_at: '2026-04-21',
      resolved_at: null,
      reporter: { display_name: 'Alice' },
      reported: { display_name: 'Bob' },
      admin: null,
    };
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: row, error: null }),
        }),
      }),
    });
    const res = await getAdminReport(new Request('http://localhost'), detailParams('r-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.reporter_name).toBe('Alice');
    expect(body.report.reported_name).toBe('Bob');
  });
});

describe('PATCH /api/admin/reports/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid status', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await patchAdminReport(patchReq({ status: 'weird' }), detailParams('r-1'));
    expect(res.status).toBe(400);
  });

  it('rejects invalid resolution', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await patchAdminReport(patchReq({ resolution: 'nope' }), detailParams('r-1'));
    expect(res.status).toBe(400);
  });

  it('requires at least one field', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const res = await patchAdminReport(patchReq({}), detailParams('r-1'));
    expect(res.status).toBe(400);
  });

  it('stamps admin_person_id + resolved_at on terminal status', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'r-1',
        status: 'actioned',
        resolution: 'actioned',
        admin_notes: null,
        admin_person_id: 'admin-1',
        resolved_at: '2026-04-21',
      },
      error: null,
    });
    mockServiceFrom.mockReturnValue({
      update: updateMock,
      eq: eqMock,
      select: selectMock,
      single: singleMock,
    });
    const res = await patchAdminReport(
      patchReq({ status: 'actioned', resolution: 'actioned' }),
      detailParams('r-1'),
    );
    expect(res.status).toBe(200);
    const updatesArg = updateMock.mock.calls[0][0];
    expect(updatesArg.status).toBe('actioned');
    expect(updatesArg.resolution).toBe('actioned');
    expect(updatesArg.admin_person_id).toBe('admin-1');
    expect(typeof updatesArg.resolved_at).toBe('string');
  });

  it('does not stamp admin_person_id when only changing to reviewing', async () => {
    mockRequireAdmin.mockResolvedValue(adminGuard());
    const updateMock = vi.fn().mockReturnThis();
    mockServiceFrom.mockReturnValue({
      update: updateMock,
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'r-1',
          status: 'reviewing',
          resolution: null,
          admin_notes: null,
          admin_person_id: null,
          resolved_at: null,
        },
        error: null,
      }),
    });
    const res = await patchAdminReport(patchReq({ status: 'reviewing' }), detailParams('r-1'));
    expect(res.status).toBe(200);
    const updatesArg = updateMock.mock.calls[0][0];
    expect(updatesArg.status).toBe('reviewing');
    expect('admin_person_id' in updatesArg).toBe(false);
    expect('resolved_at' in updatesArg).toBe(false);
  });
});
