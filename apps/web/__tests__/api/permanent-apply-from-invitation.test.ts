import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/apply/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn().mockResolvedValue(undefined),
}));

// Feature flag mock — these tests prove the apply-after-invite plumbing
// for when Stage 2 unlocks. The locked-state behaviour (route silently
// drops `fromInvitationId` so the application is recorded without
// invitation attribution) is covered in
// `permanent-apply-from-invitation-locked.test.ts`.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: true,
}));

const mockFromAuth = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk(userId = 'crew1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockServiceFrom, rpc: vi.fn() },
    },
  };
}

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/permanent/pp1/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: 'pp1' });

/**
 * Stubs the two auth-client lookups the route does before the
 * invitation-validation block: posting fetch + duplicate-app check.
 * Both happy-path so the route reaches the apply-after-invite code.
 */
function setupHappyPath() {
  // posting fetch
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'pp1',
            status: 'active',
            required_certification_ids: [],
            employer_person_id: 'emp1',
          },
        }),
      }),
    }),
  });
  // duplicate-app check
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  });
}

function invitationLookupChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

describe('POST /api/permanent/:id/apply — apply-after-invite (v2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
  });

  it('threads invited_from_id when invitation is valid (matches posting + caller, status pending)', async () => {
    setupHappyPath();
    mockServiceFrom.mockReturnValueOnce(
      invitationLookupChain({
        id: 'inv-1',
        permanent_posting_id: 'pp1',
        crew_person_id: 'crew1',
        status: 'pending',
      }),
    );

    const res = await POST(makeRequest({ fromInvitationId: 'inv-1' }), { params });
    expect(res.status).toBe(200);

    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBe('inv-1');
  });

  it('drops invited_from_id silently when invitation is for a different posting', async () => {
    setupHappyPath();
    mockServiceFrom.mockReturnValueOnce(
      invitationLookupChain({
        id: 'inv-1',
        permanent_posting_id: 'pp-OTHER',
        crew_person_id: 'crew1',
        status: 'pending',
      }),
    );

    const res = await POST(makeRequest({ fromInvitationId: 'inv-1' }), { params });
    expect(res.status).toBe(200); // forgiving — apply still proceeds
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
  });

  it('drops invited_from_id silently when invitation is addressed to a different crew', async () => {
    setupHappyPath();
    mockServiceFrom.mockReturnValueOnce(
      invitationLookupChain({
        id: 'inv-1',
        permanent_posting_id: 'pp1',
        crew_person_id: 'someone-else',
        status: 'pending',
      }),
    );

    const res = await POST(makeRequest({ fromInvitationId: 'inv-1' }), { params });
    expect(res.status).toBe(200);
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
  });

  it('drops invited_from_id silently when invitation status is not pending', async () => {
    setupHappyPath();
    mockServiceFrom.mockReturnValueOnce(
      invitationLookupChain({
        id: 'inv-1',
        permanent_posting_id: 'pp1',
        crew_person_id: 'crew1',
        status: 'expired',
      }),
    );

    const res = await POST(makeRequest({ fromInvitationId: 'inv-1' }), { params });
    expect(res.status).toBe(200);
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
  });

  it('drops invited_from_id silently when invitation does not exist', async () => {
    setupHappyPath();
    mockServiceFrom.mockReturnValueOnce(invitationLookupChain(null));

    const res = await POST(makeRequest({ fromInvitationId: 'inv-not-real' }), { params });
    expect(res.status).toBe(200);
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
  });

  it('omits invited_from_id from payload when fromInvitationId is absent', async () => {
    setupHappyPath();
    // No invitation lookup expected.

    const res = await POST(makeRequest({}), { params });
    expect(res.status).toBe(200);
    expect(mockServiceFrom).not.toHaveBeenCalled();
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
  });
});
