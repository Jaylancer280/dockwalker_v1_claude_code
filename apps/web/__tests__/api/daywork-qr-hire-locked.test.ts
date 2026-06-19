import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/daywork/route';

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

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  getQrHireLimit: () => ({ limit: vi.fn().mockResolvedValue({ success: true, remaining: 5, reset: 0 }) }),
}));

// Feature flag hard-locked off — the QR-hire branch must reject before
// any FK validation / event append.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: false,
  CV_BUILDER_LOCKED_PAYLOAD: { error: 'DockWalker CV — Coming Soon', message: 'locked' },
}));

const mockFromAuth = vi.fn();
const mockServiceFrom = vi.fn();

function singleChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'employer-1' },
      person: { id: 'employer-1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'employer-1' },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockServiceFrom, rpc: vi.fn() },
    },
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

const baseBody = {
  vesselId: 'v1',
  roleId: 'r1',
  locationPortId: 'p1',
  startDate: futureDate(1),
  endDate: futureDate(5),
  workingDays: 5,
  dayRate: '250',
  currency: 'EUR',
};

describe('POST /api/daywork — QR-hire branch locked (CV_BUILDER_ENABLED = false)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // FK lookups happen before the QR-hire branch check; satisfy them
    // so the route reaches the inviteCrewPersonId branch.
    mockFromAuth
      .mockReturnValueOnce(singleChain({ id: 'v1' }))
      .mockReturnValueOnce(singleChain({ id: 'r1' }))
      .mockReturnValueOnce(singleChain({ id: 'p1' }));
  });

  it('returns 503 with Coming-Soon when inviteCrewPersonId is supplied', async () => {
    const res = await POST(makeRequest({ ...baseBody, inviteCrewPersonId: 'crew-1' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Coming Soon/);

    // Critical: NO daywork was created. The captain doesn't end up
    // with a public posting + a phantom uninvited crew member.
    expect(mockAppendEvents).not.toHaveBeenCalled();
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('regular daywork POST (no inviteCrewPersonId) still works while CV Builder is locked', async () => {
    const res = await POST(makeRequest(baseBody));
    // Regular path: a single DAYWORK.POSTED via appendEvent.
    expect(res.status).toBe(201);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0]![1].eventType).toBe('DAYWORK.POSTED');
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });
});
