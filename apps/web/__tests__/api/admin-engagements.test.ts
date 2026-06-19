import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/engagements/route';
import { POST } from '@/app/api/admin/engagements/[id]/complete/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockServiceFrom = vi.fn();

function adminOk() {
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

describe('GET /api/admin/engagements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await GET(new Request('http://localhost/api/admin/engagements'));
    expect(res.status).toBe(403);
  });

  it('lists engagements', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{
          id: 'eng-1', status: 'active', daywork_id: 'dw-1', permanent_posting_id: null,
          crew_person_id: 'c1', employer_person_id: 'e1',
          start_date: '2026-01-01', end_date: '2026-01-05', cancelled_by: null,
          created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
          crew_profile: { display_name: 'Alice' },
          employer_profile: { display_name: 'Bob' },
        }],
        count: 1,
        error: null,
      }),
    };
    mockServiceFrom.mockReturnValue(chain);

    const res = await GET(new Request('http://localhost/api/admin/engagements'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagements).toHaveLength(1);
    expect(body.engagements[0].crew_name).toBe('Alice');
    expect(body.total).toBe(1);
  });
});

describe('POST /api/admin/engagements/:id/complete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('force-completes engagement', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'eng-1', daywork_id: 'dw-1', status: 'active' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/admin/engagements/eng-1/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Employer unresponsive for 30 days' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'eng-1' }) });
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'ADMIN.ENGAGEMENT_COMPLETED' }),
    );
  });

  it('returns 400 without reason', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'eng-1', daywork_id: 'dw-1', status: 'active' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/admin/engagements/eng-1/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'eng-1' }) });
    expect(res.status).toBe(400);
  });
});
