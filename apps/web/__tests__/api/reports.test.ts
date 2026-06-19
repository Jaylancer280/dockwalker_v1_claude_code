import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as submitReport, GET as listReports } from '@/app/api/reports/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

const mockServiceFrom = vi.fn();
const mockSupabaseFrom = vi.fn();

function userGuard(personId: string) {
  return {
    ok: true,
    value: {
      user: { id: personId },
      person: { id: personId, identity_type: 'crew', current_hat: 'crew', is_admin: false },
      profile: { person_id: personId },
      supabase: { from: mockSupabaseFrom },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function postReq(body: Record<string, unknown>) {
  return new Request('http://localhost/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function openCount(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  };
}

function insertOk(id: string) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
      }),
    }),
  };
}

describe('POST /api/reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await submitReport(
      postReq({
        reported_person_id: 'other',
        reason_category: 'spam',
        reason_text: 'test',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects self-report', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-1',
        reason_category: 'spam',
        reason_text: 'test',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/your own account/i);
  });

  it('rejects invalid reason_category', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        reason_category: 'bogus',
        reason_text: 'test',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects empty reason_text', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        reason_category: 'spam',
        reason_text: '   ',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects reason_text over 1000 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        reason_category: 'spam',
        reason_text: 'x'.repeat(1001),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 429 when at open-report cap', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    mockServiceFrom.mockReturnValue(openCount(5));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        reason_category: 'spam',
        reason_text: 'another',
      }),
    );
    expect(res.status).toBe(429);
  });

  it('creates the report and returns 201', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    mockServiceFrom.mockReturnValue(openCount(2));
    mockSupabaseFrom.mockReturnValue(insertOk('report-123'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        engagement_id: 'eng-7',
        reason_category: 'harassment',
        reason_text: 'harassing messages',
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report_id).toBe('report-123');
  });

  it('accepts report with no engagement_id', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    mockServiceFrom.mockReturnValue(openCount(0));
    mockSupabaseFrom.mockReturnValue(insertOk('report-42'));
    const res = await submitReport(
      postReq({
        reported_person_id: 'user-2',
        reason_category: 'fraud',
        reason_text: 'fake profile',
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe('GET /api/reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await listReports();
    expect(res.status).toBe(401);
  });

  it('lists own reports most-recent-first', async () => {
    mockRequireDomainUser.mockResolvedValue(userGuard('user-1'));
    const rows = [
      {
        id: 'r1',
        reported_person_id: 'user-2',
        engagement_id: null,
        reason_category: 'spam',
        status: 'open',
        created_at: '2026-04-21T10:00:00Z',
      },
    ];
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    });
    const res = await listReports();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].id).toBe('r1');
  });
});
