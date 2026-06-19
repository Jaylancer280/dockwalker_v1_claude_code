import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(userId = 'u1', hat = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: hat },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { rpc: vi.fn() },
    },
  };
}

/* ── chain builders ── */

function notifChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count }),
        }),
      }),
    }),
  };
}

function engagementChain(
  data: { id: string; crew_person_id: string; employer_person_id: string }[],
) {
  return {
    select: vi.fn().mockReturnValue({
      or: vi.fn().mockResolvedValue({ data }),
    }),
  };
}

describe('GET /api/notifications/count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function callGET() {
    const { GET } = await import('@/app/api/notifications/count/route');
    return GET();
  }

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await callGET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns counts with zero engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth
      .mockReturnValueOnce(notifChain(3))
      .mockReturnValueOnce(notifChain(1))
      .mockReturnValueOnce(engagementChain([]));

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      notification_count: 3,
      message_count: 0,
      alt_notification_count: 1,
      alt_message_count: 0,
    });
  });

  it('returns message_count as threads with unread, not total unread', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));

    const engagements = [
      { id: 'eng-a', crew_person_id: 'u1', employer_person_id: 'e1' },
      { id: 'eng-b', crew_person_id: 'u1', employer_person_id: 'e2' },
    ];

    mockFromAuth
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(engagementChain(engagements));

    // RPC returns both engagements with unread (3 and 2 respectively)
    mockRpc.mockResolvedValueOnce({
      data: [
        { engagement_id: 'eng-a', unread_count: 3 },
        { engagement_id: 'eng-b', unread_count: 2 },
      ],
    });

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    // message_count = 2 (threads with unread), not 5 (total)
    expect(body.message_count).toBe(2);
    expect(body.alt_message_count).toBe(0);
  });

  it('returns alt counts for other hat engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));

    const engagements = [
      { id: 'eng-c', crew_person_id: 'other', employer_person_id: 'u1' },
    ];

    mockFromAuth
      .mockReturnValueOnce(notifChain(2))
      .mockReturnValueOnce(notifChain(5))
      .mockReturnValueOnce(engagementChain(engagements));

    mockRpc.mockResolvedValueOnce({
      data: [{ engagement_id: 'eng-c', unread_count: 4 }],
    });

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      notification_count: 2,
      message_count: 0,
      alt_notification_count: 5,
      alt_message_count: 1,
    });
  });

  it('handles RPC returning empty (no unread anywhere)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));

    const engagements = [
      { id: 'eng-d', crew_person_id: 'u1', employer_person_id: 'e1' },
    ];

    mockFromAuth
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(engagementChain(engagements));

    // RPC returns empty — all cursors caught up
    mockRpc.mockResolvedValueOnce({ data: [] });

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message_count).toBe(0);
  });
});
