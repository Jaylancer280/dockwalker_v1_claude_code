import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as NotificationsGET } from '@/app/api/notifications/route';
import { POST as ReadPOST } from '@/app/api/notifications/read/route';
import { GET as CountGET } from '@/app/api/notifications/count/route';
import { POST as MessageReadPOST } from '@/app/api/messages/[engagementId]/read/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// GET /api/notifications
// =========================================================================
describe('GET /api/notifications', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new Request('http://localhost/api/notifications');
    const res = await NotificationsGET(req);
    expect(res.status).toBe(401);
  });

  it('returns notifications and unread count', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const notifs = [
      { id: 'n1', type: 'application_received', title: 'New applicant', body: 'Someone applied', deep_link: '/daywork/d1/review', read: false, created_at: new Date().toISOString() },
    ];

    // notifications query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: notifs, error: null }),
          }),
        }),
      }),
    });

    // unread count
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 1 }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/notifications');
    const res = await NotificationsGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(1);
    expect(body.unread_count).toBe(1);
  });
});

// =========================================================================
// POST /api/notifications/read
// =========================================================================
describe('POST /api/notifications/read', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const res = await ReadPOST(req);
    expect(res.status).toBe(401);
  });

  it('marks all as read', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const res = await ReadPOST(req);
    expect(res.status).toBe(200);
  });

  it('marks specific IDs as read', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ['n1', 'n2'] }),
    });
    const res = await ReadPOST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when no IDs or all flag', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const req = new Request('http://localhost/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await ReadPOST(req);
    expect(res.status).toBe(400);
  });
});

// =========================================================================
// POST /api/messages/[engagementId]/read
// =========================================================================
describe('POST /api/messages/:engagementId/read', () => {
  const params = Promise.resolve({ engagementId: 'eng1' });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new Request('http://localhost/api/messages/eng1/read', { method: 'POST' });
    const res = await MessageReadPOST(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns 403 when not a participant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'eng1', crew_person_id: 'other', employer_person_id: 'other2' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/messages/eng1/read', { method: 'POST' });
    const res = await MessageReadPOST(req, { params });
    expect(res.status).toBe(403);
  });

  it('succeeds for valid participant', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // engagement query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'eng1', crew_person_id: 'u1', employer_person_id: 'emp1' },
          }),
        }),
      }),
    });

    // upsert
    mockFromAuth.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = new Request('http://localhost/api/messages/eng1/read', { method: 'POST' });
    const res = await MessageReadPOST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
