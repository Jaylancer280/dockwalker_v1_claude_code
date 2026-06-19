import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/daywork/[id]/available-crew/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockFromService = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'employer-1' },
      person: { id: 'employer-1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'employer-1' },
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockFromService },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });
const makeReq = (query = '') =>
  new Request(`http://localhost/api/daywork/d1/available-crew${query}`);

// Per-table mock helpers — each returns a one-shot chain matching the
// terminal method the route uses for that table. Updated for the
// region-scoped + distance-sorted matcher (00138 / "available crew
// hybrid scope" change).

function mockDaywork(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

/** Origin port lookup — now also embeds the city's region_id and the
 *  port's lat/lng coords. Pass null for coords to exercise the
 *  no-coords fallback path. */
function mockOriginPort(data: {
  city_id: string;
  latitude: number | null;
  longitude: number | null;
  region_id: string | null;
} | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: data
            ? {
                city_id: data.city_id,
                latitude: data.latitude,
                longitude: data.longitude,
                cities: data.region_id ? { region_id: data.region_id } : null,
              }
            : null,
        }),
      }),
    }),
  });
}

/** Region cities lookup — only fires when the origin port has a
 *  region_id. Pass an empty array to short-circuit back to city-only. */
function mockRegionCities(rows: Array<{ id: string }>) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

/** availability_windows query — moved to serviceClient (employer can't
 *  read other crew's availability under RLS without the service-client
 *  bypass; the matcher legitimately needs to discover non-applicants). */
function mockAvailability(rows: Array<Record<string, unknown>>) {
  // .select().in().eq().gte().lte().gt()
  const terminal = vi.fn().mockResolvedValue({ data: rows });
  mockFromService.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              gt: terminal,
            }),
          }),
        }),
      }),
    }),
  });
}

function mockExclusionPair(applicationsRows: unknown[], invitationsRows: unknown[]) {
  const buildChain = (rows: unknown[]) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: rows }),
      }),
    }),
  });
  mockFromAuth.mockReturnValueOnce(buildChain(applicationsRows));
  mockFromAuth.mockReturnValueOnce(buildChain(invitationsRows));
}

function mockSubscriptions(rows: Array<{ person_id: string }>) {
  mockFromService.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: rows }),
        }),
      }),
    }),
  });
}

function mockInvitationCount(count: number) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count }),
      }),
    }),
  });
}

/** Port coords lookup — fires only when at least one candidate has a
 *  pinned port_id on their availability window. */
function mockPortCoords(
  rows: Array<{ id: string; latitude: number | null; longitude: number | null }>,
) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

function mockProfiles(rows: Array<Record<string, unknown>>) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

function mockShoreExperiences(rows: Array<Record<string, unknown>>) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows }),
    }),
  });
}

const baseDaywork = {
  id: 'd1',
  poster_person_id: 'employer-1',
  start_date: '2026-05-15',
  end_date: '2026-05-20',
  role_id: 'role-deck',
  location_port_id: 'port-1',
  status: 'active',
  positions_available: 1,
};

const proCrewProfile = {
  person_id: 'crew-pro-1',
  display_name: 'Pro Crew',
  avatar_url: null,
  primary_role_id: 'role-engineer', // mismatch with daywork's role-deck
  certification_ids: [],
  languages: [],
  experience_bracket_id: null,
  vessel_size_exposure_ids: [],
  bio: null,
  location_port_id: 'port-1',
  nationality_id: null,
  nationality_ids: [],
  yacht_roles: { id: 'role-engineer', name: 'Engineer', department: 'Engineering' },
  experience_brackets: null,
  ports: null,
  nationalities: null,
};

describe('GET /api/daywork/:id/available-crew — monetization invariant (B-010)', () => {
  beforeEach(() => {
    mockFromAuth.mockReset();
    mockFromService.mockReset();
    mockRequireDomainUser.mockReset();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('surfaces a Crew Pro crew with current availability + role mismatch when allRoles=true', async () => {
    mockDaywork(baseDaywork);
    mockOriginPort({ city_id: 'city-1', latitude: 43.5, longitude: 7.1, region_id: 'region-1' });
    mockRegionCities([{ id: 'city-1' }, { id: 'city-2' }]);
    mockAvailability([
      {
        person_id: 'crew-pro-1',
        date: '2026-05-16',
        city_id: 'city-1',
        port_id: 'port-1',
        not_available: false,
        created_at: '2026-05-10T00:00:00Z',
      },
      {
        person_id: 'crew-pro-1',
        date: '2026-05-17',
        city_id: 'city-1',
        port_id: 'port-1',
        not_available: false,
        created_at: '2026-05-10T00:00:00Z',
      },
    ]);
    mockExclusionPair([], []);
    mockSubscriptions([{ person_id: 'crew-pro-1' }]);
    mockInvitationCount(0);
    // Candidate has port_id=port-1 → port coords fetch fires (single
    // batch). No centroid path because every candidate has a port pin.
    mockPortCoords([{ id: 'port-1', latitude: 43.5, longitude: 7.1 }]);
    mockProfiles([proCrewProfile]);
    mockShoreExperiences([]);

    const res = await GET(makeReq('?allRoles=true'), makeParams('d1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.crew).toHaveLength(1);
    expect(body.crew[0]).toMatchObject({
      person_id: 'crew-pro-1',
      available_days: 2,
      primary_role_id: 'role-engineer',
      proximity: 'same-port',
    });
  });

  it('hides the same Crew Pro crew when allRoles=false because role mismatches the posting', async () => {
    mockDaywork(baseDaywork);
    mockOriginPort({ city_id: 'city-1', latitude: 43.5, longitude: 7.1, region_id: 'region-1' });
    mockRegionCities([{ id: 'city-1' }]);
    mockAvailability([
      {
        person_id: 'crew-pro-1',
        date: '2026-05-16',
        city_id: 'city-1',
        port_id: 'port-1',
        not_available: false,
        created_at: '2026-05-10T00:00:00Z',
      },
    ]);
    mockExclusionPair([], []);
    mockSubscriptions([{ person_id: 'crew-pro-1' }]);
    mockInvitationCount(0);
    mockPortCoords([{ id: 'port-1', latitude: 43.5, longitude: 7.1 }]);
    mockProfiles([proCrewProfile]);
    mockShoreExperiences([]);

    const res = await GET(makeReq(), makeParams('d1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.crew).toHaveLength(0);
  });

  it('hides a non-Pro crew even when role matches and availability is current', async () => {
    mockDaywork(baseDaywork);
    mockOriginPort({ city_id: 'city-1', latitude: 43.5, longitude: 7.1, region_id: 'region-1' });
    mockRegionCities([{ id: 'city-1' }]);
    mockAvailability([
      {
        person_id: 'free-crew-1',
        date: '2026-05-16',
        city_id: 'city-1',
        port_id: 'port-1',
        not_available: false,
        created_at: '2026-05-10T00:00:00Z',
      },
    ]);
    mockExclusionPair([], []);
    mockSubscriptions([]); // no pro subs — filter to 0 candidates
    mockInvitationCount(0);
    // Route returns early after the count call — no further mocks needed.

    const res = await GET(makeReq(), makeParams('d1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.crew).toHaveLength(0);
  });
});
