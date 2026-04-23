import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/mine/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/daywork/mine${query}`);
}

describe('GET /api/daywork/mine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 409 when onboarding incomplete', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(409);
  });

  /**
   * Route calls `.from('dayworks')...` for the main query, then
   * `.from('applications').select('daywork_id').in(...).in(...)` to batch the
   * pending-applicant count. Mock both chains by branching on the table name.
   */
  function makeFromBranching(params: {
    dayworks: unknown[];
    applications?: Array<{ daywork_id: string }>;
    dayworksAssertChain?: (chain: {
      mockSelect: ReturnType<typeof vi.fn>;
      mockEqPoster: ReturnType<typeof vi.fn>;
      mockOrder: ReturnType<typeof vi.fn>;
      mockIn: ReturnType<typeof vi.fn>;
      mockEqRole: ReturnType<typeof vi.fn>;
      mockEqPort: ReturnType<typeof vi.fn>;
    }) => void;
  }) {
    // Applications count builder — terminal .in() resolves with rows
    const appsInStatus = vi.fn().mockResolvedValue({ data: params.applications ?? [], error: null });
    const appsInDaywork = vi.fn().mockReturnValue({ in: appsInStatus });
    const appsSelect = vi.fn().mockReturnValue({ in: appsInDaywork });

    // Dayworks main query builder
    const mockEqPort = vi.fn().mockResolvedValue({ data: params.dayworks, error: null });
    const mockEqRole = vi.fn().mockReturnValue({ eq: mockEqPort });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEqRole, ...{} });
    // When no filters, the main query resolves off `.order(...)` directly.
    const mockOrder = vi
      .fn()
      .mockImplementation(() => ({ in: mockIn, then: (r: (v: unknown) => void) => r({ data: params.dayworks, error: null }) }));
    const mockEqPoster = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqPoster });

    if (params.dayworksAssertChain) {
      params.dayworksAssertChain({
        mockSelect,
        mockEqPoster,
        mockOrder,
        mockIn,
        mockEqRole,
        mockEqPort,
      });
    }

    mockFromAuth.mockImplementation((table: string) => {
      if (table === 'dayworks') return { select: mockSelect };
      if (table === 'applications') return { select: appsSelect };
      return { select: vi.fn() };
    });
  }

  it('returns 200 with dayworks list and applicant_count=0 when no applicants', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    makeFromBranching({
      dayworks: [{ id: 'd1', status: 'active', end_date: '2099-01-01' }],
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toEqual([
      { id: 'd1', status: 'active', end_date: '2099-01-01', is_overdue: false, applicant_count: 0 },
    ]);
  });

  it('returns applicant_count as the pending-application total per posting', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    makeFromBranching({
      dayworks: [
        { id: 'd1', status: 'active', end_date: '2099-01-01' },
        { id: 'd2', status: 'active', end_date: '2099-01-01' },
      ],
      // d1 has 3 pending applicants, d2 has none
      applications: [
        { daywork_id: 'd1' },
        { daywork_id: 'd1' },
        { daywork_id: 'd1' },
      ],
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.dayworks.find((d: { id: string }) => d.id === 'd1').applicant_count).toBe(3);
    expect(body.dayworks.find((d: { id: string }) => d.id === 'd2').applicant_count).toBe(0);
  });

  it('passes roleId and portId filters to query', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    // Chain with status + role + port filters: .order().in(status).eq(role).eq(port) → resolves
    const mockEqPort = vi.fn().mockResolvedValue({
      data: [{ id: 'd1', status: 'active', end_date: '2099-01-01' }],
      error: null,
    });
    const mockEqRole = vi.fn().mockReturnValue({ eq: mockEqPort });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEqRole });
    const mockOrder = vi.fn().mockReturnValue({ in: mockIn });
    const mockEqPoster = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqPoster });

    const appsInStatus = vi.fn().mockResolvedValue({ data: [], error: null });
    const appsInDaywork = vi.fn().mockReturnValue({ in: appsInStatus });
    const appsSelect = vi.fn().mockReturnValue({ in: appsInDaywork });

    mockFromAuth.mockImplementation((table: string) => {
      if (table === 'dayworks') return { select: mockSelect };
      if (table === 'applications') return { select: appsSelect };
      return { select: vi.fn() };
    });

    const res = await GET(makeRequest('?status=active&roleId=r1&portId=p1'));
    expect(res.status).toBe(200);
    expect(mockEqRole).toHaveBeenCalledWith('role_id', 'r1');
    expect(mockEqPort).toHaveBeenCalledWith('location_port_id', 'p1');
  });
});
