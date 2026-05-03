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

// Helper: mock origin port query — now returns lat/lng + cities.region_id
// for the region-scoped matcher (00138 / hybrid scope change). The
// `cities:city_id(region_id)` embed renders as a nested object in the
// response.
function mockPort(
  data:
    | { city_id: string; latitude?: number | null; longitude?: number | null; region_id?: string | null }
    | null,
) {
  const shaped = data
    ? {
        city_id: data.city_id,
        latitude: data.latitude ?? 43.5,
        longitude: data.longitude ?? 7.1,
        cities: data.region_id ? { region_id: data.region_id } : { region_id: 'region-default' },
      }
    : null;
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: shaped }),
      }),
    }),
  });
}

// Helper: region cities lookup. Fires whenever the origin port has a
// region_id (which our default mockPort always does). At minimum
// returns the originating city.
function mockRegionCities(rows: Array<{ id: string }> = [{ id: 'city-1' }]) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

// Helper: availability_windows query — moved to serviceClient (employer
// can't read other crew's rows under RLS without the bypass; the
// matcher legitimately needs to discover non-applicants). Now queries
// with `.in('city_id', regionCityIds)` instead of `.eq()`.
//
// Each row needs `port_id` and `created_at` for the new aggregation +
// tiebreak chain. Tests that don't care can omit them; we backfill.
function mockAvailWindows(data: Record<string, unknown>[]) {
  const shaped = data.map((row) => ({
    port_id: null,
    created_at: '2026-05-10T00:00:00Z',
    ...row,
  }));
  mockServiceFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data: shaped }),
            }),
          }),
        }),
      }),
    }),
  });
}

// Helper: optional batch lookup for candidate port coords (only fires
// when at least one candidate has a pinned port_id in their availability
// rows). Tests using crew with no port_id can skip this entirely.
function mockPortCoords(
  rows: Array<{ id: string; latitude: number | null; longitude: number | null }> = [],
) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

// Helper: city centroid lookup (only fires when a candidate has no
// port_id pinned — the route uses the average of their city's port
// coords as a fallback anchor).
function mockCityCentroidPorts(
  rows: Array<{ city_id: string; latitude: number | null; longitude: number | null }> = [],
) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows }),
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

// Helper: mock shore_experiences query (runs after profiles when matched crew > 0)
function mockShoreExperiences(data: Record<string, unknown>[] = []) {
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
    // mockReset (not clearAllMocks) on both — clearAllMocks leaves
    // queued mockReturnValueOnce in place across tests, which corrupts
    // the per-table mock chain when the new region-scoped flow adds
    // extra calls.
    mockFromAuth.mockReset();
    mockServiceFrom.mockReset();
    mockRequireDomainUser.mockReset();
  });

  it('returns crew with availability overlap in same city', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-02', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-03', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1']);
    mockInvitationCount(0);
    // No port pin in availWindows → only the city-centroid lookup
    // fires (and resolves empty since these tests don't care about
    // distance ordering — distance becomes Infinity, candidates fall
    // through to position-by-tiebreak).
    mockCityCentroidPorts([]);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);
    mockShoreExperiences();

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
    expect(body.crew[0].available_days).toBe(3);
    expect(body.crew[0].shore_experience_categories).toEqual([]);
    expect(body.invitation_count).toBe(0);
    expect(body.invitation_limit).toBe(3);
  });

  it('excludes crew who already applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    // c1 already applied
    mockExclusions([{ crew_person_id: 'c1' }], []);
    mockProSubs(['c2']);
    mockInvitationCount(0);
    // No port pin in availWindows → only the city-centroid lookup
    // fires (and resolves empty since these tests don't care about
    // distance ordering — distance becomes Infinity, candidates fall
    // through to position-by-tiebreak).
    mockCityCentroidPorts([]);
    mockProfiles([
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-deckhand' },
    ]);
    mockShoreExperiences();

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c2');
  });

  it('excludes crew already invited', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    // c2 already invited
    mockExclusions([], [{ crew_person_id: 'c2' }]);
    mockProSubs(['c1']);
    mockInvitationCount(1);
    mockCityCentroidPorts([]);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);
    mockShoreExperiences();

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
    mockRegionCities();
    // u1 (employer) has availability — should be excluded
    mockAvailWindows([
      { person_id: 'u1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1']);
    mockInvitationCount(0);
    // No port pin in availWindows → only the city-centroid lookup
    // fires (and resolves empty since these tests don't care about
    // distance ordering — distance becomes Infinity, candidates fall
    // through to position-by-tiebreak).
    mockCityCentroidPorts([]);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
    ]);
    mockShoreExperiences();

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    if (res.status !== 200) {
      throw new Error(`route returned ${res.status}: ${JSON.stringify(body)}`);
    }
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
  });

  it('default role filter matches daywork role', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1', 'c2']);
    mockInvitationCount(0);
    mockCityCentroidPorts([]);
    // c1 matches role, c2 does not
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-engineer' },
    ]);
    mockShoreExperiences();

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0].person_id).toBe('c1');
  });

  it('allRoles=true returns crew of any role', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    mockProSubs(['c1', 'c2']);
    mockInvitationCount(0);
    // No port pin in availWindows → only the city-centroid lookup
    // fires (and resolves empty since these tests don't care about
    // distance ordering — distance becomes Infinity, candidates fall
    // through to position-by-tiebreak).
    mockCityCentroidPorts([]);
    mockProfiles([
      { person_id: 'c1', display_name: 'Crew One', primary_role_id: 'role-deckhand' },
      { person_id: 'c2', display_name: 'Crew Two', primary_role_id: 'role-engineer' },
    ]);
    mockShoreExperiences([
      { person_id: 'c1', shore_experience_categories: { name: 'Hospitality' } },
      { person_id: 'c1', shore_experience_categories: { name: 'Fitness' } },
      { person_id: 'c2', shore_experience_categories: { name: 'Military' } },
    ]);

    const res = await GET(
      new Request('http://localhost?allRoles=true'),
      makeParams('d1'),
    );
    const body = await res.json();
    expect(body.crew).toHaveLength(2);
    const c1 = body.crew.find((c: { person_id: string }) => c.person_id === 'c1');
    const c2 = body.crew.find((c: { person_id: string }) => c.person_id === 'c2');
    expect(c1.shore_experience_categories).toEqual(['Hospitality', 'Fitness']);
    expect(c2.shore_experience_categories).toEqual(['Military']);
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

  it('excludes free crew (no subscription) from results', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    // c1 has no Pro subscription — empty result from subscriptions query
    mockProSubs([]);
    mockInvitationCount(0);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(0);
  });

  it('excludes crew with cancelled subscription', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    // c1 subscription is cancelled — not returned by the Pro filter query
    mockProSubs([]);
    mockInvitationCount(0);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    const body = await res.json();
    expect(body.crew).toHaveLength(0);
  });

  it('returns empty array (not error) when zero Pro crew available', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockRegionCities();
    mockAvailWindows([
      { person_id: 'c1', date: '2026-04-01', city_id: 'city-1', not_available: false },
      { person_id: 'c2', date: '2026-04-01', city_id: 'city-1', not_available: false },
    ]);
    mockExclusions([], []);
    // Neither crew member is Pro
    mockProSubs([]);
    mockInvitationCount(0);

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crew).toHaveLength(0);
    expect(body.crew).toEqual([]);
    expect(body.invitation_count).toBe(0);
  });
});
