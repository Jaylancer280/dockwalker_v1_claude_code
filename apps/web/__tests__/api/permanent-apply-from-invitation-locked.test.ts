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

// Feature flag hard-locked off. The route still works for regular
// /discover applies — it just silently ignores `fromInvitationId` so
// no invitation context is recorded with the application. This keeps
// /discover applies functional while the CV Builder feature is
// disabled.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: false,
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

describe('POST /api/permanent/:id/apply — apply-after-invite locked (CV_BUILDER_ENABLED = false)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
  });

  it('regular apply (no fromInvitationId) still works — flag off, route untouched on this path', async () => {
    setupHappyPath();
    const res = await POST(makeRequest({}), { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
    // The route never attempted an invitation lookup — flag is off.
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it('silently drops fromInvitationId when feature is locked', async () => {
    setupHappyPath();
    const res = await POST(
      makeRequest({ fromInvitationId: 'inv-1' }),
      { params },
    );
    // Application is still recorded — the user successfully applied.
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);

    // Critical: the invitation context is NOT carried into the event.
    // The locked flag short-circuits the validation block; the route
    // never queries permanent_invitations.
    const payload = mockAppendEvent.mock.calls[0]![1].payload;
    expect(payload.invited_from_id).toBeUndefined();
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });
});
