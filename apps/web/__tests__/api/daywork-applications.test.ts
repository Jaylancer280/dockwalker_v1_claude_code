import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/applications/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

function makeAppsChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

describe('GET /api/daywork/applications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 200 with empty applications', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications).toEqual([]);
  });

  it('returns 200 with hydrated applications', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeAppsChain([
        {
          id: 'app1',
          daywork_id: 'd1',
          status: 'applied',
          message: 'Great fit!',
          created_at: '2026-03-10T12:00:00Z',
          dayworks: {
            id: 'd1',
            job_number: 42,
            start_date: '2026-03-15',
            end_date: '2026-03-20',
            working_days: 5,
            day_rate: 350,
            currency: 'EUR',
            meals: ['lunch'],
            notes: null,
            status: 'active',
            vessel_id: 'v1',
            yacht_roles: { id: 'r1', name: 'Deckhand' },
            ports: {
              id: 'p1',
              name: 'Port Vauban',
              cities: { name: 'Antibes', regions: { name: 'French Riviera' } },
            },
            experience_brackets: { label: '1-3 years' },
          },
        },
      ]),
    );
    // Batch vessel RPC
    mockRpc.mockResolvedValueOnce({
      data: [{
        id: 'v1',
        name: 'MY Serenity',
        vessel_type: 'motor',
        size_band_label: '40-60m',
        nda_flag: false,
      }],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications).toHaveLength(1);

    const app = body.applications[0];
    expect(app.id).toBe('app1');
    expect(app.status).toBe('applied');
    expect(app.message).toBe('Great fit!');
    expect(app.daywork.role_name).toBe('Deckhand');
    expect(app.daywork.vessel_name).toBe('MY Serenity');
    expect(app.daywork.port_name).toBe('Port Vauban');
    expect(app.daywork.city_name).toBe('Antibes');
    expect(app.daywork.region_name).toBe('French Riviera');
    expect(app.daywork.day_rate).toBe(350);
    expect(app.daywork.job_number).toBe(42);
  });

  it('returns NDA Vessel for nda-flagged vessels', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeAppsChain([
        {
          id: 'app2',
          daywork_id: 'd2',
          status: 'viewed',
          message: null,
          created_at: '2026-03-10T12:00:00Z',
          dayworks: {
            id: 'd2',
            job_number: 43,
            start_date: '2026-03-15',
            end_date: '2026-03-20',
            working_days: 5,
            day_rate: 400,
            currency: 'GBP',
            meals: [],
            notes: null,
            status: 'active',
            vessel_id: 'v2',
            yacht_roles: { id: 'r1', name: 'Chef' },
            ports: null,
            experience_brackets: null,
          },
        },
      ]),
    );
    mockRpc.mockResolvedValueOnce({
      data: [{
        id: 'v2',
        name: 'Secret Yacht',
        vessel_type: 'sail',
        size_band_label: '60-80m',
        nda_flag: true,
      }],
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications[0].daywork.vessel_name).toBe('NDA Vessel');
  });

  it('returns 500 on database error', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeAppsChain(null, { message: 'db error' }),
    );

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('only includes applied, viewed, shortlisted statuses', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const chain = makeAppsChain([]);
    mockFromAuth.mockReturnValueOnce(chain);

    await GET();

    // Verify the .in() call filters to only pending statuses
    const selectCall = chain.select.mock.results[0].value;
    const eqCall = selectCall.eq.mock.results[0].value;
    expect(eqCall.in).toHaveBeenCalledWith('status', ['applied', 'viewed', 'shortlisted']);
  });
});
