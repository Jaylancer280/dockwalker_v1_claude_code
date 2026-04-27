import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

import { POST as createRef } from '@/app/api/references/route';
import { POST as acceptRef } from '@/app/api/references/[id]/accept/route';
import { POST as declineRef } from '@/app/api/references/[id]/decline/route';
import { POST as commentRef } from '@/app/api/references/[id]/comment/route';
import { POST as revokeRef } from '@/app/api/references/[id]/revoke/route';
import { POST as resendRef } from '@/app/api/references/[id]/resend/route';
import { POST as contactRef } from '@/app/api/references/[id]/contact/route';
import { GET as getMine } from '@/app/api/references/mine/route';
import { GET as getByToken } from '@/app/api/references/by-token/[token]/route';
import { POST as acceptContact } from '@/app/api/reference-contacts/[id]/accept/route';
import { POST as declineContact } from '@/app/api/reference-contacts/[id]/decline/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
const mockAppendEvents = vi.fn().mockResolvedValue(['evt-1', 'evt-2']);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

const mockNotifyOnEvent = vi.fn();
vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: (...args: unknown[]) => mockNotifyOnEvent(...args),
}));

vi.mock('@/lib/vessels/historical-names', () => ({
  resolveHistoricalVesselNames: vi.fn().mockResolvedValue(new Map()),
}));

const mockAuthGetUser = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();
const mockServiceRpc = vi.fn();
const mockServiceClient = {
  from: mockServiceFrom,
  rpc: mockServiceRpc,
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => Promise.resolve(mockServiceClient),
}));

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockSupabaseFrom, auth: { getUser: mockAuthGetUser } },
      serviceClient: mockServiceClient,
      ...overrides,
    },
  };
}

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

interface ChainOpts {
  count?: number | null;
}
function chainResolve(data: unknown, opts: ChainOpts = {}) {
  const result = { data, error: null, count: opts.count ?? null };
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.eq = handler;
  chain.neq = handler;
  chain.gte = handler;
  chain.in = handler;
  chain.lt = handler;
  chain.not = handler;
  chain.or = handler;
  chain.order = handler;
  chain.limit = handler;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.single = () => Promise.resolve(result);
  chain.returns = () => chain;
  chain.then = (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb);
  return chain;
}

describe('POST /api/references', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('returns 401 unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await createRef(
      new Request('http://localhost/api/references', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects when required body fields missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await createRef(
      new Request('http://localhost/api/references', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/experienceId/);
  });

  it('rejects when crew identity is agent', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'agent', current_hat: 'agent' } }),
    );
    const res = await createRef(
      new Request('http://localhost/api/references', {
        method: 'POST',
        body: JSON.stringify({
          experienceId: 'exp1',
          claimedRefereeRole: 'Captain',
          claimedRefereeName: 'Smith',
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('B-2 rejects when experience.is_current=true', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockSupabaseFrom.mockReturnValueOnce(
      chainResolve({
        id: 'exp1',
        person_id: 'u1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2024-01-01',
        end_date: null,
        is_current: true,
      }),
    );
    const res = await createRef(
      new Request('http://localhost/api/references', {
        method: 'POST',
        body: JSON.stringify({
          experienceId: 'exp1',
          claimedRefereeRole: 'Captain',
          claimedRefereeName: 'Smith',
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/currently-active|completed before/);
  });

  it('rejects on NDA vessel', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockSupabaseFrom.mockReturnValueOnce(
      chainResolve({
        id: 'exp1',
        person_id: 'u1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        is_current: false,
      }),
    );
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'v1',
        name: 'Test',
        imo_number: '1111111',
        nda_flag: true,
        source: 'curated',
        hidden_at: null,
      }),
    );
    const res = await createRef(
      new Request('http://localhost/api/references', {
        method: 'POST',
        body: JSON.stringify({
          experienceId: 'exp1',
          claimedRefereeRole: 'Captain',
          claimedRefereeName: 'Smith',
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/NDA/);
  });

  it('returns 402 with crew_pro_required gate on Free at cap', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // experience
    mockSupabaseFrom.mockReturnValueOnce(
      chainResolve({
        id: 'exp1',
        person_id: 'u1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        is_current: false,
      }),
    );
    // vessel
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'v1',
        name: 'Test',
        imo_number: '1111111',
        nda_flag: false,
        source: 'curated',
        hidden_at: null,
      }),
    );
    // yacht_roles
    mockServiceFrom.mockReturnValueOnce(chainResolve({ name: 'Bosun' }));
    // existing pending refs (auto-supersede pre-check) — none match
    mockServiceFrom.mockReturnValueOnce(chainResolve([]));
    // subscriptions (Free)
    mockServiceFrom.mockReturnValueOnce(chainResolve(null));
    // existing references count — at cap (1 for Free)
    mockServiceFrom.mockReturnValueOnce(chainResolve(null, { count: 1 }));
    const res = await createRef(
      new Request('http://localhost/api/references', {
        method: 'POST',
        body: JSON.stringify({
          experienceId: 'exp1',
          claimedRefereeRole: 'Captain',
          claimedRefereeName: 'Smith',
        }),
      }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.gate?.reason).toBe('crew_pro_required');
    expect(body.gate?.upgrade_path).toBe('/billing');
  });
});

describe('POST /api/references/[id]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('returns 410 if not pending', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'accepted',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        claimed_referee_email: null,
        snapshot_vessel_name: 'Boat',
      }),
    );
    const res = await acceptRef(
      new Request('http://localhost/api/references/r1/accept', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(410);
  });

  it('rejects on email mismatch', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'pending',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        claimed_referee_email: 'expected@example.com',
        snapshot_vessel_name: 'Boat',
      }),
    );
    mockAuthGetUser.mockResolvedValue({ data: { user: { email: 'someone@else.com' } } });
    const res = await acceptRef(
      new Request('http://localhost/api/references/r1/accept', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(403);
  });

  it('batches REFERENCE.ACCEPTED + REFERENCE.COMMENT_UPDATED when comment present', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'pending',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        claimed_referee_email: null,
        snapshot_vessel_name: 'Boat',
      }),
    );
    const res = await acceptRef(
      new Request('http://localhost/api/references/r1/accept', {
        method: 'POST',
        body: JSON.stringify({ comment: 'Great crew member' }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvents).toHaveBeenCalledOnce();
    expect(mockAppendEvents.mock.calls[0][1]).toHaveLength(2);
    expect(mockAppendEvents.mock.calls[0][1][0].eventType).toBe('REFERENCE.ACCEPTED');
    expect(mockAppendEvents.mock.calls[0][1][1].eventType).toBe('REFERENCE.COMMENT_UPDATED');
  });

  it('rejects comment over 500 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'pending',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        claimed_referee_email: null,
        snapshot_vessel_name: 'Boat',
      }),
    );
    const res = await acceptRef(
      new Request('http://localhost/api/references/r1/accept', {
        method: 'POST',
        body: JSON.stringify({ comment: 'a'.repeat(501) }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/references/[id]/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('routes requester to REVOKED_BY_REQUESTER when caller is requester', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'accepted',
        requester_person_id: 'u1',
        referee_person_id: 'u2',
      }),
    );
    const res = await revokeRef(
      new Request('http://localhost/api/references/r1/revoke', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('REFERENCE.REVOKED_BY_REQUESTER');
  });

  it('routes referee to REVOKED_BY_REFEREE when caller is referee', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'accepted',
        requester_person_id: 'u2',
        referee_person_id: 'u1',
      }),
    );
    const res = await revokeRef(
      new Request('http://localhost/api/references/r1/revoke', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('REFERENCE.REVOKED_BY_REFEREE');
  });

  it('rejects referee revoke on pending (only accepted allowed)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'pending',
        requester_person_id: 'u2',
        referee_person_id: 'u1',
      }),
    );
    const res = await revokeRef(
      new Request('http://localhost/api/references/r1/revoke', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 403 when caller is neither requester nor referee', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'accepted',
        requester_person_id: 'u2',
        referee_person_id: 'u3',
      }),
    );
    const res = await revokeRef(
      new Request('http://localhost/api/references/r1/revoke', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/references/[id]/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('B-3 fires REVOKED + fresh REQUESTED with salted idempotency key', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u1',
        experience_id: 'exp1',
        vessel_id: 'v1',
        requester_role_at_time: 'Bosun',
        claimed_referee_role: 'Captain',
        claimed_referee_name: 'Smith',
        claimed_referee_email: null,
        snapshot_vessel_imo: '1111111',
        snapshot_vessel_name: 'Boat',
        snapshot_start_date: '2024-01-01',
        snapshot_end_date: '2024-06-30',
        status: 'pending',
      }),
    );
    const res = await resendRef(
      new Request('http://localhost/api/references/r1/resend', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvents).toHaveBeenCalledOnce();
    const events = mockAppendEvents.mock.calls[0][1];
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('REFERENCE.REVOKED_BY_REQUESTER');
    expect(events[1].eventType).toBe('REFERENCE.REQUESTED');
    expect(events[1].idempotencyKey).toBe('REFERENCE.REQUESTED:resend:r1');
  });
});

describe('POST /api/references/[id]/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('rejects when caller is not employer/agent', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' } }),
    );
    const res = await contactRef(
      new Request('http://localhost/api/references/r1/contact', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 402 with pending_budget gate when Free at 10 pending', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );
    // reference accepted
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u2', snapshot_vessel_name: 'Boat' }),
    );
    // subscription (free)
    mockServiceFrom.mockReturnValueOnce(chainResolve(null));
    // pending count — at cap
    mockServiceFrom.mockReturnValueOnce(chainResolve(null, { count: 10 }));

    const res = await contactRef(
      new Request('http://localhost/api/references/r1/contact', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.gate?.reason).toBe('pending_budget');
  });

  it('returns 402 with monthly_budget gate when Free at 5 accepted/30d', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u2', snapshot_vessel_name: 'Boat' }),
    );
    mockServiceFrom.mockReturnValueOnce(chainResolve(null));
    mockServiceFrom.mockReturnValueOnce(chainResolve(null, { count: 0 })); // pending OK
    mockServiceFrom.mockReturnValueOnce(chainResolve(null, { count: 5 })); // accepted-30d at cap

    const res = await contactRef(
      new Request('http://localhost/api/references/r1/contact', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.gate?.reason).toBe('monthly_budget');
  });

  it('rejects when underlying reference is not accepted', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'pending', referee_person_id: null, snapshot_vessel_name: 'Boat' }),
    );
    const res = await contactRef(
      new Request('http://localhost/api/references/r1/contact', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(409);
  });

  it('rejects when caller is the referee (self-contact)', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );
    // referee_person_id matches the caller — dual-hat user contacting their own reference
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u1', snapshot_vessel_name: 'Boat' }),
    );
    const res = await contactRef(
      new Request('http://localhost/api/references/r1/contact', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/can't contact yourself/i);
  });
});

describe('POST /api/references/[id]/decline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('fires REFERENCE.DECLINED with no notification', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(chainResolve({ id: 'r1', status: 'pending' }));
    const res = await declineRef(
      new Request('http://localhost/api/references/r1/decline', { method: 'POST' }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('REFERENCE.DECLINED');
    expect(mockNotifyOnEvent).not.toHaveBeenCalled();
  });
});

describe('POST /api/references/[id]/comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('rejects non-referee', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u2' }),
    );
    const res = await commentRef(
      new Request('http://localhost/api/references/r1/comment', {
        method: 'POST',
        body: JSON.stringify({ comment: 'x' }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects when reference is not accepted', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'pending', referee_person_id: 'u1' }),
    );
    const res = await commentRef(
      new Request('http://localhost/api/references/r1/comment', {
        method: 'POST',
        body: JSON.stringify({ comment: 'x' }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(409);
  });

  it('rejects comment over 500 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u1' }),
    );
    const res = await commentRef(
      new Request('http://localhost/api/references/r1/comment', {
        method: 'POST',
        body: JSON.stringify({ comment: 'a'.repeat(501) }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(400);
  });

  it('notifies the requester when the referee edits the comment', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'accepted',
        referee_person_id: 'u1',
        requester_person_id: 'u2',
        snapshot_vessel_name: 'Burkut',
      }),
    );
    const res = await commentRef(
      new Request('http://localhost/api/references/r1/comment', {
        method: 'POST',
        body: JSON.stringify({ comment: 'updated comment' }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockNotifyOnEvent).toHaveBeenCalledWith(
      mockServiceClient,
      'REFERENCE.COMMENT_UPDATED',
      expect.objectContaining({
        reference_id: 'r1',
        recipient_person_id: 'u2',
        snapshot_vessel_name: 'Burkut',
        cleared: false,
      }),
      'u1',
    );
  });

  it('flags the cleared variant when comment is removed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        status: 'accepted',
        referee_person_id: 'u1',
        requester_person_id: 'u2',
        snapshot_vessel_name: 'Burkut',
      }),
    );
    const res = await commentRef(
      new Request('http://localhost/api/references/r1/comment', {
        method: 'POST',
        body: JSON.stringify({ comment: null }),
      }),
      params({ id: 'r1' }),
    );
    expect(res.status).toBe(200);
    expect(mockNotifyOnEvent).toHaveBeenCalledWith(
      mockServiceClient,
      'REFERENCE.COMMENT_UPDATED',
      expect.objectContaining({ cleared: true }),
      'u1',
    );
  });
});

describe('GET /api/references/by-token/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('rejects very short tokens', async () => {
    const res = await getByToken(new Request('http://localhost'), params({ token: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 410 when status is not pending', async () => {
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'accepted',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        requester_role_at_time: 'Bosun',
        claimed_referee_role: 'Captain',
        claimed_referee_email: null,
        snapshot_vessel_imo: '1111111',
        snapshot_vessel_name: 'Boat',
        snapshot_start_date: '2024-01-01',
        snapshot_end_date: '2024-06-30',
      }),
    );
    const res = await getByToken(
      new Request('http://localhost'),
      params({ token: '0123456789abcdef0123456789abcdef' }),
    );
    expect(res.status).toBe(410);
  });

  it('masks claimed_referee_email when returned', async () => {
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'r1',
        requester_person_id: 'u2',
        status: 'pending',
        pending_expires_at: new Date(Date.now() + 86400000).toISOString(),
        requester_role_at_time: 'Bosun',
        claimed_referee_role: 'Captain',
        claimed_referee_email: 'captain@example.com',
        snapshot_vessel_imo: '1111111',
        snapshot_vessel_name: 'Boat',
        snapshot_start_date: '2024-01-01',
        snapshot_end_date: '2024-06-30',
      }),
    );
    mockServiceFrom.mockReturnValueOnce(chainResolve({ display_name: 'Smith' }));
    const res = await getByToken(
      new Request('http://localhost'),
      params({ token: '0123456789abcdef0123456789abcdef' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed_referee_email_masked).toBe('c***n@example.com');
    expect(body.claimed_referee_email_required).toBe(true);
  });
});

describe('GET /api/references/mine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('returns three buckets', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(chainResolve([{ id: 'r1' }])); // outbound
    mockServiceFrom.mockReturnValueOnce(chainResolve([{ id: 'r2' }])); // inbound_accepted
    mockServiceFrom.mockReturnValueOnce(chainResolve([])); // inbound_pending
    const res = await getMine();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('outbound');
    expect(body).toHaveProperty('inbound_accepted');
    expect(body).toHaveProperty('inbound_pending');
    expect(body.outbound).toHaveLength(1);
    expect(body.inbound_accepted).toHaveLength(1);
    expect(body.inbound_pending).toHaveLength(0);
  });
});

describe('POST /api/reference-contacts/[id]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('rejects when caller is not the referee', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'c1',
        status: 'pending',
        reference_id: 'r1',
        employer_person_id: 'u2',
        question: null,
      }),
    );
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u9' }),
    );
    const res = await acceptContact(
      new Request('http://localhost/api/reference-contacts/c1/accept', { method: 'POST' }),
      params({ id: 'c1' }),
    );
    expect(res.status).toBe(403);
  });

  it('fires CONTACT_ACCEPTED + first MESSAGE.SENT when question present', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'c1',
        status: 'pending',
        reference_id: 'r1',
        employer_person_id: 'u2',
        question: 'How were they?',
      }),
    );
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'r1', status: 'accepted', referee_person_id: 'u1' }),
    );
    const res = await acceptContact(
      new Request('http://localhost/api/reference-contacts/c1/accept', { method: 'POST' }),
      params({ id: 'c1' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagementId).toMatch(/^[0-9a-f-]+$/);
    // Two events: CONTACT_ACCEPTED + MESSAGE.SENT (the employer's question)
    expect(mockAppendEvent).toHaveBeenCalledTimes(2);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('REFERENCE.CONTACT_ACCEPTED');
    expect(mockAppendEvent.mock.calls[1][1].eventType).toBe('MESSAGE.SENT');
  });

  it('returns 410 when contact is no longer pending', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({
        id: 'c1',
        status: 'declined',
        reference_id: 'r1',
        employer_person_id: 'u2',
        question: null,
      }),
    );
    const res = await acceptContact(
      new Request('http://localhost/api/reference-contacts/c1/accept', { method: 'POST' }),
      params({ id: 'c1' }),
    );
    expect(res.status).toBe(410);
  });
});

describe('POST /api/reference-contacts/[id]/decline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    mockServiceFrom.mockReset();
  });

  it('rejects non-referee', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'c1', status: 'pending', reference_id: 'r1' }),
    );
    mockServiceFrom.mockReturnValueOnce(chainResolve({ referee_person_id: 'u9' }));
    const res = await declineContact(
      new Request('http://localhost/api/reference-contacts/c1/decline', { method: 'POST' }),
      params({ id: 'c1' }),
    );
    expect(res.status).toBe(403);
  });

  it('fires REFERENCE.CONTACT_DECLINED silently (no notification)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockServiceFrom.mockReturnValueOnce(
      chainResolve({ id: 'c1', status: 'pending', reference_id: 'r1' }),
    );
    mockServiceFrom.mockReturnValueOnce(chainResolve({ referee_person_id: 'u1' }));
    const res = await declineContact(
      new Request('http://localhost/api/reference-contacts/c1/decline', { method: 'POST' }),
      params({ id: 'c1' }),
    );
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('REFERENCE.CONTACT_DECLINED');
    expect(mockNotifyOnEvent).not.toHaveBeenCalled();
  });
});
