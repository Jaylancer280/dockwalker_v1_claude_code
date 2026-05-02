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

// Per-table mock helpers — each returns a one-shot chain matching the terminal
// method the route uses for that table.

function mockDaywork(data: Record<string, unknown> | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockPort(data: { city_id: string } | null) {
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  });
}

function mockAvailability(rows: Array<Record<string, unknown>>) {
  // .select().eq().eq().gte().lte().gt()
  const terminal = vi.fn().mockResolvedValue({ data: rows });
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
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
  // Two .from() calls in Promise.all — order in route: applications first, then daywork_invitations.
  // Both: .select().eq().in()
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
  // .select().in().eq().in()
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
  // .select(_, { count, head }).eq().eq() — terminal returns { count }
  mockFromAuth.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count }),
      }),
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
    // mockReset (not clearAllMocks) so any unconsumed mockReturnValueOnce
    // from a previous test doesn't bleed into this one's queue.
    mockFromAuth.mockReset();
    mockFromService.mockReset();
    mockRequireDomainUser.mockReset();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('surfaces a Crew Pro crew with current availability + role mismatch when allRoles=true', async () => {
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailability([
      { person_id: 'crew-pro-1', date: '2026-05-16', city_id: 'city-1', not_available: false },
      { person_id: 'crew-pro-1', date: '2026-05-17', city_id: 'city-1', not_available: false },
    ]);
    mockExclusionPair([], []); // no existing apps, no existing invitations
    mockSubscriptions([{ person_id: 'crew-pro-1' }]); // pro
    mockInvitationCount(0);
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
    });
  });

  it('hides the same Crew Pro crew when allRoles=false because role mismatches the posting', async () => {
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailability([
      { person_id: 'crew-pro-1', date: '2026-05-16', city_id: 'city-1', not_available: false },
    ]);
    mockExclusionPair([], []);
    mockSubscriptions([{ person_id: 'crew-pro-1' }]);
    mockInvitationCount(0);
    mockProfiles([proCrewProfile]);
    mockShoreExperiences([]);

    const res = await GET(makeReq(), makeParams('d1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.crew).toHaveLength(0);
  });

  it('hides a non-Pro crew even when role matches and availability is current', async () => {
    mockDaywork(baseDaywork);
    mockPort({ city_id: 'city-1' });
    mockAvailability([
      { person_id: 'free-crew-1', date: '2026-05-16', city_id: 'city-1', not_available: false },
    ]);
    mockExclusionPair([], []);
    mockInvitationCount(0); // route fetches invitation count before the proEligibleIds early-return
    mockSubscriptions([]); // no pro subs — serviceClient
    // Route returns early after the count call — no profiles / shore_experiences fetch.

    const res = await GET(makeReq(), makeParams('d1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.crew).toHaveLength(0);
  });
});
