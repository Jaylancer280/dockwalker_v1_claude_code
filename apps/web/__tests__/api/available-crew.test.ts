import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/[id]/available-crew/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockServiceFrom, rpc: vi.fn() },
      ...overrides,
    },
  };
}

// Helper: mock Pro subscriptions query (service client)
function mockProSubs(personIds: string[]) {
  mockServiceFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: personIds.map((id) => ({ person_id: id })),
          }),
        }),
      }),
    }),
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// Helper: mock daywork query returning active daywork owned by u1
function mockDaywork(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

// Helper: mock port query
function mockPort(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

// Helper: mock availability_windows query
function mockAvailWindows(data: Record<string, unknown>[]) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data }),
            }),
          }),
        }),
      }),
    }),
  });
}

// Helper: mock invitation count
function mockInvitationCount(count: number) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count }),
      }),
    }),
  });
}

// Helper: mock applications + invitations parallel queries
function mockExclusions(
  applied: { crew_person_id: string }[],
  invited: { crew_person_id: string }[],
) {
  // applications query
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: applied }),
      }),
    }),
  });
  // invitations query
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: invited }),
      }),
    }),
  });
}

// Helper: mock profiles query
function mockProfiles(data: Record<string, unknown>[]) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data }),
    }),
  });
}

const baseDaywork = {
  id: 'd1',
  poster_person_id: 'u1',
  start_date: '2026-04-01',
  end_date: '2026-04-05',
  role_id: 'role-deckhand',
  location_port_id: 'port-1',
  status: 'active',
  positions_available: 1,
};

describe('GET /api/daywork/:id/available-crew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceFrom.mockReset();
  });

  it('returns crew with availability overlap in same city', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-02', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-03', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1']);
    mockInvitationCount(0);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
    expect(body.crew[0].available_days).toBe(3);
    expect(body.invitation_count).toBe(0);
    expect(body.invitation_limit).toBe(3);
  });

  it('excludes crew who already applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    // c1 already applied
    mockExclusions([{ crew_person_id: 'c1' }], []);
    mockProSubs(['c2']);
    mockInvitationCount(0);
    mockProfiles([
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-deckhand' },
    ]);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c2');
  });

  it('excludes crew already invited', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    // c2 already invited
    mockExclusions([], [{ crew_person_id: 'c2' }]);
    mockProSubs(['c1']);
    mockInvitationCount(1);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
    expect(body.invitation_count).toBe(1);
  });

  it('excludes employer themselves', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    // u1 (employer) has availability — should be excluded
    mockAvailWindows([
      { person_id: 'u1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1']);
    mockInvitationCount(0);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
  });

  it('default role filter matches daywork role', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1', 'c2']);
    mockInvitationCount(0);
    // c1 matches role, c2 does not
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-engineer' },
    ]);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
  });

  it('allRoles=true returns crew of any role', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1', 'c2']);
    mockInvitationCount(0);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-engineer' },
    ]);

    const res = await GET(
      new Request('http://localhost?allRoles=true'),
      makeParams('d1'),
    );
    const body = await res.json();
    expect(body.crew).toHaveLength(2);
  });

  it('returns 403 if not posting owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork({ ...baseDaywork, poster_person_id: 'other-user' });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns empty if daywork is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork({ ...baseDaywork, status: 'in_progress' });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crew).toHaveLength(0);
  });
});
