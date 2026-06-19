import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/permanent/applications/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(userId = 'crew1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAppsChain(data: any[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data, error: null });
  return chain;
}

describe('GET /api/permanent/applications', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when hat is employer', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        user: { id: 'u1' },
        person: { id: 'u1', current_hat: 'employer' },
        profile: {},
        supabase: { from: mockFromAuth, rpc: mockRpc },
        serviceClient: { from: vi.fn(), rpc: vi.fn() },
      },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns empty array when no permanent applications', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toEqual([]);
  });

  it('returns applications with correct response shape', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeAppsChain([
        {
          id: 'a1',
          permanent_posting_id: 'pp1',
          status: 'applied',
          message: 'Interested',
          rejection_reason: null,
          created_at: '2026-03-20T12:00:00Z',
          permanent_postings: {
            id: 'pp1',
            job_number: 1,
            start_date: '2099-01-01',
            salary_min: 3000,
            salary_max: 5000,
            salary_currency: 'EUR',
            salary_period: 'monthly',
            live_aboard: true,
            shortlist_cap: 5,
            notes: null,
            status: 'active',
            vessel_id: 'v1',
            employer_person_id: 'emp1',
            required_certification_ids: [],
            yacht_roles: { id: 'r1', name: 'Captain' },
            ports: { id: 'p1', name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'French Riviera' } } },
            experience_brackets: { label: '2-5 years' },
          },
        },
      ]),
    );
    // Vessel RPC
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v1', name: 'Serenity', vessel_type: 'motor', size_band_label: '40-60m', nda_flag: false }],
      error: null,
    });
    // Poster profiles
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ person_id: 'emp1', display_name: 'Capt One' }] }),
      }),
    });
    // Cert names (none)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toHaveLength(1);
    const app = data.applications[0];
    expect(app.type).toBe('permanent');
    expect(app.status).toBe('applied');
    expect(app.posting.salary_min).toBe(3000);
    expect(app.posting.role_name).toBe('Captain');
    expect(app.posting.poster_name).toBe('Capt One');
    expect(app.posting.vessel_name).toBe('Serenity');
  });

  it('returns 200 for all crew-visible statuses query', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeAppsChain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applications).toEqual([]);
  });
});
