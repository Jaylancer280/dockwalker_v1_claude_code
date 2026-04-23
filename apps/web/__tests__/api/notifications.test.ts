import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as NotificationsGET } from '@/app/api/notifications/route';
import { POST as ReadPOST } from '@/app/api/notifications/read/route';
import { POST as ReadGroupPOST } from '@/app/api/notifications/read-group/route';
import { GET as CountGET } from '@/app/api/notifications/count/route';
import { POST as MessageReadPOST } from '@/app/api/messages/[engagementId]/read/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpcAuth = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth, rpc: mockRpcAuth },
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
// GET /api/notifications?grouped=true
// =========================================================================
describe('GET /api/notifications?grouped=true', () => {
  it('calls grouped_notifications RPC and returns groups + unread count', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const groups = [
      {
        group_key: 'application_received:/daywork/d1/review',
        type: 'application_received',
        title: 'New applicant',
        body: 'Someone applied',
        deep_link: '/daywork/d1/review',
        created_at: new Date().toISOString(),
        read: false,
        role_context: 'employer',
        total_count: 3,
        unread_count: 3,
        latest_id: 'n3',
      },
    ];

    mockRpcAuth.mockResolvedValue({ data: groups, error: null });

    // unread count query (still runs on the notifications table)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 3 }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/notifications?grouped=true');
    const res = await NotificationsGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockRpcAuth).toHaveBeenCalledWith('grouped_notifications');
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].total_count).toBe(3);
    expect(body.unread_count).toBe(3);
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
      body: JSON.stringify({ notificationIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'] }),
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
// POST /api/notifications/read-group
// =========================================================================
describe('POST /api/notifications/read-group', () => {
  it('marks all notifications with matching type + deep_link as read', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const eqDeepLink = vi.fn().mockResolvedValue({ error: null });
    const eqRead = vi.fn().mockReturnValue({ eq: eqDeepLink });
    const eqType = vi.fn().mockReturnValue({ eq: eqRead });
    const eqPerson = vi.fn().mockReturnValue({ eq: eqType });
    const update = vi.fn().mockReturnValue({ eq: eqPerson });
    mockFromAuth.mockReturnValueOnce({ update });

    const req = new Request('http://localhost/api/notifications/read-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'application_received', deep_link: '/daywork/d1/review' }),
    });
    const res = await ReadGroupPOST(req);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ read: true });
    expect(eqDeepLink).toHaveBeenCalledWith('deep_link', '/daywork/d1/review');
  });

  it('handles deep_link=null via .is()', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const isDeepLink = vi.fn().mockResolvedValue({ error: null });
    const eqRead = vi.fn().mockReturnValue({ is: isDeepLink });
    const eqType = vi.fn().mockReturnValue({ eq: eqRead });
    const eqPerson = vi.fn().mockReturnValue({ eq: eqType });
    const update = vi.fn().mockReturnValue({ eq: eqPerson });
    mockFromAuth.mockReturnValueOnce({ update });

    const req = new Request('http://localhost/api/notifications/read-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'system_notice', deep_link: null }),
    });
    const res = await ReadGroupPOST(req);
    expect(res.status).toBe(200);
    expect(isDeepLink).toHaveBeenCalledWith('deep_link', null);
  });

  it('returns 400 when type is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const req = new Request('http://localhost/api/notifications/read-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deep_link: '/x' }),
    });
    const res = await ReadGroupPOST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when deep_link field is omitted (safety — prevents cross-resource wipe)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const req = new Request('http://localhost/api/notifications/read-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'application_received' }),
    });
    const res = await ReadGroupPOST(req);
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
