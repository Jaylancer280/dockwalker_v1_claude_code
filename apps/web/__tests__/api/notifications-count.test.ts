import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'u1', hat = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: hat },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
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

function cursorChain(
  data: { engagement_id: string; last_read_at: string }[],
) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function messageCountChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({ count }),
        }),
      }),
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
      .mockReturnValueOnce(notifChain(3)) // current hat (crew) notifs
      .mockReturnValueOnce(notifChain(1)) // alt hat (employer) notifs
      .mockReturnValueOnce(engagementChain([])); // no engagements

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
      .mockReturnValueOnce(notifChain(0)) // current hat notifs
      .mockReturnValueOnce(notifChain(0)) // alt hat notifs
      .mockReturnValueOnce(engagementChain(engagements)) // 2 engagements
      .mockReturnValueOnce(cursorChain([])) // no cursors
      .mockReturnValueOnce(messageCountChain(3)) // eng-a: 3 unread
      .mockReturnValueOnce(messageCountChain(2)); // eng-b: 2 unread

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    // message_count = 2 (threads with unread), not 5 (total unread messages)
    expect(body.message_count).toBe(2);
    expect(body.alt_message_count).toBe(0);
  });

  it('returns alt counts for other hat engagements', async () => {
    // User's current hat is crew, but they have an engagement as employer
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));

    const engagements = [
      { id: 'eng-c', crew_person_id: 'other', employer_person_id: 'u1' },
    ];

    mockFromAuth
      .mockReturnValueOnce(notifChain(2)) // current hat notifs
      .mockReturnValueOnce(notifChain(5)) // alt hat notifs
      .mockReturnValueOnce(engagementChain(engagements))
      .mockReturnValueOnce(cursorChain([]))
      .mockReturnValueOnce(messageCountChain(4)); // 4 unread in employer engagement

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      notification_count: 2,
      message_count: 0, // no crew engagements
      alt_notification_count: 5,
      alt_message_count: 1, // 1 employer thread with unread
    });
  });

  it('respects read cursor when counting unread messages', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));

    const engagements = [
      { id: 'eng-d', crew_person_id: 'u1', employer_person_id: 'e1' },
      { id: 'eng-e', crew_person_id: 'u1', employer_person_id: 'e2' },
    ];

    const cursors = [
      { engagement_id: 'eng-d', last_read_at: '2026-03-20T10:00:00Z' },
    ];

    mockFromAuth
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(notifChain(0))
      .mockReturnValueOnce(engagementChain(engagements))
      .mockReturnValueOnce(cursorChain(cursors))
      .mockReturnValueOnce(messageCountChain(0)) // eng-d: 0 unread (cursor caught up)
      .mockReturnValueOnce(messageCountChain(1)); // eng-e: 1 unread (no cursor, epoch baseline)

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    // Only eng-e has unread, eng-d cursor caught up
    expect(body.message_count).toBe(1);

    // Verify the cursor was passed through: eng-d's .gt() gets the cursor timestamp,
    // eng-e's .gt() gets the epoch fallback
    const msgCallD = mockFromAuth.mock.results[4].value;
    const gtFnD = msgCallD.select().eq().neq().gt;
    expect(gtFnD).toHaveBeenCalledWith('created_at', '2026-03-20T10:00:00Z');

    const msgCallE = mockFromAuth.mock.results[5].value;
    const gtFnE = msgCallE.select().eq().neq().gt;
    expect(gtFnE).toHaveBeenCalledWith('created_at', '1970-01-01T00:00:00Z');
  });
});
