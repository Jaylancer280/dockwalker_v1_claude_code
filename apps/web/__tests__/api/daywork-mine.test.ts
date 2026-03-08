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

  it('returns 200 with dayworks list', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const dayworks = [{ id: 'd1', status: 'active' }];
    const mockOrder = vi.fn().mockResolvedValue({ data: dayworks, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder, in: vi.fn() });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFromAuth.mockReturnValue({ select: mockSelect });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayworks).toEqual(dayworks);
  });

  it('passes roleId and portId filters to query', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const dayworks = [{ id: 'd1', status: 'active' }];
    // Chain: .from().select().eq(poster).order().in(status).eq(role_id).eq(port_id) → resolves
    const mockEqPort = vi.fn().mockResolvedValue({ data: dayworks, error: null });
    const mockEqRole = vi.fn().mockReturnValue({ eq: mockEqPort });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEqRole });
    const mockOrder = vi.fn().mockReturnValue({ in: mockIn });
    const mockEqPoster = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqPoster });
    mockFromAuth.mockReturnValue({ select: mockSelect });

    const res = await GET(makeRequest('?status=active&roleId=r1&portId=p1'));
    expect(res.status).toBe(200);
    expect(mockEqRole).toHaveBeenCalledWith('role_id', 'r1');
    expect(mockEqPort).toHaveBeenCalledWith('location_port_id', 'p1');
  });
});
