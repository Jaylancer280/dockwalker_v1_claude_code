import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/profile/[personId]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => Promise.resolve({ from: mockServiceFrom }),
}));

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { rpc: vi.fn(), from: mockServiceFrom },
      ...overrides,
    },
  };
}

const makeParams = (personId: string) => ({ params: Promise.resolve({ personId }) });

// Helper to create chainable mock
function mockChain(data: unknown, opts: { count?: number } = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const resolve = () => Promise.resolve({ data, error: null, count: opts.count ?? null });
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(resolve);
  chain.maybeSingle = vi.fn().mockImplementation(resolve);
  // Make the chain thenable for await without .single()
  chain.then = vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    resolve().then(cb),
  );
  return chain;
}

describe('GET /api/profile/[personId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceFrom.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when no relationship context and no active postings', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // All relationship checks use serviceClient — no results
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Engagement
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Application
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Invitation
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Permanent application
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Active daywork
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Active permanent

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("don't have access");
  });

  it('returns 200 when target has active daywork posting (no prior relationship)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // All relationship checks use serviceClient
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Engagement
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Application
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Invitation
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Permanent application
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'dw-1' }])); // Active daywork — found

    // Profile fetch
    const employerProfile = {
      person_id: 'p2',
      display_name: 'Active Poster',
      identity_type: 'crew',
      bio: null,
      primary_role_id: null,
      certification_ids: [],
      experience_bracket_id: null,
      vessel_size_exposure_ids: [],
      location_port_id: null,
      location_city_id: null,
      nationality_id: null,
      entry_right_ids: [],
      languages: [],
      agency_name: null,
      role_specialization_ids: [],
      yacht_roles: null,
      desired_roles: null,
      experience_brackets: null,
      ports: null,
      location_cities: null,
      nationalities: null,
      avatar_url: null,
      deck_name: null,
      permanent_availability: null,
      notice_period_days: null,
    };
    mockFrom.mockReturnValueOnce(mockChain(employerProfile));

    // Experiences fetch
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences fetch
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Active Poster');
  });

  it('returns 200 for crew profile when engagement context exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Engagement check — has context (serviceClient)
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'e1' }]));

    // Profile fetch
    const crewProfile = {
      person_id: 'p2',
      display_name: 'Test Crew',
      identity_type: 'crew',
      bio: 'Bio here',
      primary_role_id: 'r1',
      certification_ids: [],
      experience_bracket_id: null,
      vessel_size_exposure_ids: [],
      location_port_id: null,
      agency_name: null,
      role_specialization_ids: [],
      yacht_roles: { id: 'r1', name: 'Deckhand', department: 'deck' },
      experience_brackets: null,
      ports: null,
    };
    mockFrom.mockReturnValueOnce(mockChain(crewProfile));

    // Experiences fetch
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences fetch
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Test Crew');
    expect(body.identity_type).toBe('crew');
    // No reputation metrics exposed
    expect(body.past_daywork_count).toBeUndefined();
    // Verify no salary fields
    expect(body.salary_amount).toBeUndefined();
    expect(body.salary_currency).toBeUndefined();
  });

  it('returns 200 for employer profile with non-NDA vessels', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Engagement check — has context (serviceClient)
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'e1' }]));

    // Profile fetch
    const employerProfile = {
      person_id: 'p2',
      display_name: 'Test Employer',
      identity_type: 'agent',
      bio: null,
      primary_role_id: null,
      certification_ids: [],
      experience_bracket_id: null,
      vessel_size_exposure_ids: [],
      location_port_id: null,
      agency_name: 'Test Agency',
      role_specialization_ids: [],
      yacht_roles: null,
      experience_brackets: null,
      ports: null,
    };
    mockFrom.mockReturnValueOnce(mockChain(employerProfile));

    // Role specializations — none
    // Vessels fetch (non-NDA only)
    mockFrom.mockReturnValueOnce(
      mockChain([
        { name: 'Yacht A', vessel_type: 'motor', loa_meters: 45, vessel_size_bands: { label: '40-50m' } },
      ]),
    );

    // Active posting count
    mockFrom.mockReturnValueOnce(mockChain(null, { count: 2 }));

    // Maritime background (experiences) — agent profile includes this
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Test Employer');
    expect(body.identity_type).toBe('agent');
    expect(body.agency_name).toBe('Test Agency');
    expect(body.vessels).toHaveLength(1);
    expect(body.vessels[0].name).toBe('Yacht A');
    expect(body.active_posting_count).toBe(2);
    expect(body.maritime_background).toEqual([]);
  });

  it('returns 200 via application context', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Engagement check — no results (serviceClient)
    mockServiceFrom.mockReturnValueOnce(mockChain([]));
    // Application check — has context (serviceClient)
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'a1' }]));

    // Profile fetch (crew)
    mockFrom.mockReturnValueOnce(
      mockChain({
        person_id: 'p2',
        display_name: 'Crew Member',
        identity_type: 'crew',
        bio: null,
        certification_ids: [],
        vessel_size_exposure_ids: [],
        role_specialization_ids: [],
        yacht_roles: null,
        experience_brackets: null,
        ports: null,
      }),
    );
    // Experiences
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
  });

  it('crew profile never includes salary fields in experiences', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Engagement context (serviceClient)
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'e1' }]));

    // Profile
    mockFrom.mockReturnValueOnce(
      mockChain({
        person_id: 'p2',
        display_name: 'Crew',
        identity_type: 'crew',
        bio: null,
        certification_ids: [],
        vessel_size_exposure_ids: [],
        role_specialization_ids: [],
        yacht_roles: null,
        experience_brackets: null,
        ports: null,
      }),
    );

    // Experiences with salary data (should not appear in response)
    mockFrom.mockReturnValueOnce(
      mockChain([
        {
          id: 'exp1',
          start_date: '2024-01-01',
          end_date: '2024-06-01',
          is_current: false,
          vessel_operation: 'charter',
          flag_state: 'GBR',
          contract_type: 'rotational',
          contract_details: '2:2 months',
          description: 'Test',
          vessels: { name: 'Test Yacht', vessel_type: 'motor', loa_meters: 45, vessel_size_bands: { label: '40-50m' } },
          yacht_roles: { name: 'Deckhand' },
        },
      ]),
    );
    // Owner subscription lookup (Phase 5 visibility filter)
    mockFrom.mockReturnValueOnce(mockChain(null));
    // References per experience (none accepted)
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiences).toHaveLength(1);
    expect(body.experiences[0].vessel_name).toBe('Test Yacht');
    expect(body.experiences[0].salary_amount).toBeUndefined();
    expect(body.experiences[0].salary_currency).toBeUndefined();
    expect(body.experiences[0].salary_period).toBeUndefined();
  });

  it('returns 200 when target has in_negotiation permanent posting (no prior relationship)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // All relationship checks use serviceClient
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Engagement
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Application
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Invitation
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Permanent application
    mockServiceFrom.mockReturnValueOnce(mockChain([])); // Active daywork
    mockServiceFrom.mockReturnValueOnce(mockChain([{ id: 'pp-1' }])); // Active permanent — found

    // Profile fetch
    mockFrom.mockReturnValueOnce(
      mockChain({
        person_id: 'p2',
        display_name: 'Negotiating Employer',
        identity_type: 'crew',
        bio: null,
        certification_ids: [],
        vessel_size_exposure_ids: [],
        role_specialization_ids: [],
        yacht_roles: null,
        experience_brackets: null,
        ports: null,
      }),
    );
    // Experiences
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams('22222222-2222-2222-2222-222222222222'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Negotiating Employer');
  });

  it('returns 200 when viewing own profile (self-preview)', async () => {
    const selfId = '11111111-1111-1111-1111-111111111111';
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ user: { id: selfId }, person: { id: selfId, identity_type: 'crew', current_hat: 'crew' } }),
    );

    // No relationship check — self-view skips it
    // Profile fetch
    mockFrom.mockReturnValueOnce(
      mockChain({
        person_id: selfId,
        display_name: 'Self User',
        identity_type: 'crew',
        bio: null,
        certification_ids: [],
        vessel_size_exposure_ids: [],
        role_specialization_ids: [],
        yacht_roles: null,
        experience_brackets: null,
        ports: null,
      }),
    );
    // Experiences
    mockFrom.mockReturnValueOnce(mockChain([]));
    // Shore experiences
    mockFrom.mockReturnValueOnce(mockChain([]));

    const res = await GET(new Request('http://localhost'), makeParams(selfId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Self User');
  });
});
