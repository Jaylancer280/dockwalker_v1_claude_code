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

const mockQrLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getQrHireLimit: () => ({ limit: mockQrLimit }),
}));

// Feature flag is hard-locked off in production. Mock to `true` so
// these tests can prove the underlying QR-hire behaviour. Locked-state
// is covered separately in `daywork-qr-hire-locked.test.ts`.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: true,
  CV_BUILDER_LOCKED_PAYLOAD: { error: 'locked', message: 'locked' },
}));

const mockFromAuth = vi.fn();
const mockServiceFrom = vi.fn();

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

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

function setupFkMocks() {
  mockFromAuth
    .mockReturnValueOnce(singleChain({ id: 'v1' })) // vessels
    .mockReturnValueOnce(singleChain({ id: 'r1' })) // yacht_roles
    .mockReturnValueOnce(singleChain({ id: 'p1' })); // ports
}

function setupTargetCrewLookup(
  data: { id: string; identity_type: string; deactivated_at: string | null; blocked_at: string | null } | null,
) {
  mockServiceFrom.mockReturnValueOnce(singleChain(data));
}

describe('POST /api/daywork — QR-hire branch (inviteCrewPersonId)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQrLimit.mockResolvedValue({ success: true, remaining: 4, reset: Date.now() + 1000 });
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('400s when inviteCrewPersonId is the wrong type', async () => {
    setupFkMocks();
    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 12345 as unknown as string }),
    );
    expect(res.status).toBe(400);
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it('429s when 5/hr per-employer rate limit fires', async () => {
    mockQrLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 1000 });
    setupFkMocks();
    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 'crew-1' }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it('404s when target crew is missing or wrong identity_type', async () => {
    setupFkMocks();
    setupTargetCrewLookup(null);
    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 'missing' }),
    );
    expect(res.status).toBe(404);
    expect(mockAppendEvents).not.toHaveBeenCalled();
  });

  it('404s when target crew is deactivated', async () => {
    setupFkMocks();
    setupTargetCrewLookup({
      id: 'crew-1',
      identity_type: 'crew',
      deactivated_at: '2026-01-01',
      blocked_at: null,
    });
    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 'crew-1' }),
    );
    expect(res.status).toBe(404);
  });

  it('atomically fires DAYWORK.POSTED + DAYWORK.INVITED', async () => {
    setupFkMocks();
    setupTargetCrewLookup({
      id: 'crew-1',
      identity_type: 'crew',
      deactivated_at: null,
      blocked_at: null,
    });

    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 'crew-1' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invited).toBe(true);

    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const events = mockAppendEvents.mock.calls[0]![1];
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('DAYWORK.POSTED');
    expect(events[1].eventType).toBe('DAYWORK.INVITED');
    expect(events[1].payload.crew_person_id).toBe('crew-1');
    expect(events[0].aggregateId).toBe(events[1].aggregateId); // same daywork_id
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('maps unique_violation (23505) on daywork_invitations to 409 with spec copy', async () => {
    setupFkMocks();
    setupTargetCrewLookup({
      id: 'crew-1',
      identity_type: 'crew',
      deactivated_at: null,
      blocked_at: null,
    });
    mockAppendEvents.mockRejectedValueOnce(
      new Error('append_events_batch failed: 23505 duplicate key'),
    );

    const res = await POST(
      makeRequest({ ...baseBody, inviteCrewPersonId: 'crew-1' }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already invited/i);
  });

  it('falls through to standard daywork POST when inviteCrewPersonId is absent', async () => {
    setupFkMocks();
    const res = await POST(makeRequest(baseBody));
    expect(res.status).toBe(201);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0]![1].eventType).toBe('DAYWORK.POSTED');
    expect(mockAppendEvents).not.toHaveBeenCalled();
    expect(mockQrLimit).not.toHaveBeenCalled();
  });
});
