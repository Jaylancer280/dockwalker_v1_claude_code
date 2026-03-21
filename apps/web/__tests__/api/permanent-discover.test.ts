import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/permanent/discover/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(userId = 'crew1', hat = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: hat },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/permanent/discover');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// Chain builder for permanent_postings queries
function makePostingsChain(data: unknown[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.contains = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error: null });
  return chain;
}

// Chain builder for applications exclusion query
function makeSimpleChain(data: unknown[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockResolvedValue({ data, error: null });
  chain.not = vi.fn().mockReturnValue(chain);
  return chain;
}

const samplePosting = {
  id: 'pp1',
  job_number: 1,
  vessel_id: 'v1',
  role_id: 'r1',
  port_id: 'p1',
  start_date: '2099-01-01',
  salary_min: 3000,
  salary_max: 5000,
  salary_currency: 'EUR',
  salary_period: 'monthly',
  live_aboard: true,
  required_certification_ids: ['c1'],
  experience_bracket_id: 'eb1',
  shortlist_cap: 5,
  notes: 'Test notes',
  status: 'active',
  created_at: '2026-03-20T12:00:00Z',
  employer_person_id: 'emp1',
  yacht_roles: { id: 'r1', name: 'Captain', department: 'deck' },
  ports: { id: 'p1', name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'French Riviera' } } },
  experience_brackets: { label: '2-5 years' },
};

describe('GET /api/permanent/discover', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when hat is employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1', 'employer'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns empty array when no permanent postings', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // existing apps query
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    // main postings query
    mockFromAuth.mockReturnValueOnce(makePostingsChain([]));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toEqual([]);
    expect(data.has_more).toBe(false);
    expect(data.next_cursor).toBeNull();
  });

  it('returns postings with correct response shape', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // existing apps query
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    // main postings query
    mockFromAuth.mockReturnValueOnce(makePostingsChain([samplePosting]));
    // vessel RPC
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'v1', name: 'Serenity', vessel_type: 'motor', size_band_id: 'sb1', size_band_label: '40-60m', nda_flag: false, loa_meters: 55, owner_person_id: 'emp1' }],
      error: null,
    });
    // poster profiles
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ person_id: 'emp1', display_name: 'Captain One' }] }),
      }),
    });
    // cert names
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'STCW' }] }),
      }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toHaveLength(1);
    const p = data.postings[0];
    expect(p.salary_min).toBe(3000);
    expect(p.salary_max).toBe(5000);
    expect(p.live_aboard).toBe(true);
    expect(p.shortlist_cap).toBe(5);
    expect(p.job_number).toBe(1);
    expect(p.role_name).toBe('Captain');
    expect(p.vessel_name).toBe('Serenity');
    expect(p.poster_name).toBe('Captain One');
    expect(p.cert_names).toEqual(['STCW']);
  });

  it('excludes postings crew has already applied to', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // existing apps query — crew applied to pp1
    const appsChain = makeSimpleChain([{ permanent_posting_id: 'pp1' }]);
    mockFromAuth.mockReturnValueOnce(appsChain);
    // main postings query
    const postingsChain = makePostingsChain([]);
    mockFromAuth.mockReturnValueOnce(postingsChain);

    await GET(makeRequest());
    // Verify the exclusion was applied via .not()
    expect(postingsChain.not).toHaveBeenCalled();
  });

  it('excludes own postings', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    const postingsChain = makePostingsChain([]);
    mockFromAuth.mockReturnValueOnce(postingsChain);

    await GET(makeRequest());
    expect(postingsChain.neq).toHaveBeenCalledWith('employer_person_id', 'crew1');
  });

  it('only returns active and in_negotiation postings', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    const postingsChain = makePostingsChain([]);
    mockFromAuth.mockReturnValueOnce(postingsChain);

    await GET(makeRequest());
    expect(postingsChain.in).toHaveBeenCalledWith('status', ['active', 'in_negotiation']);
  });

  it('cursor pagination returns has_more and next_cursor when batch full', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    // 20 postings = full batch
    const fullBatch = Array.from({ length: 20 }, (_, i) => ({
      ...samplePosting,
      id: `pp${i}`,
      created_at: `2026-03-${String(20 - i).padStart(2, '0')}T12:00:00Z`,
      required_certification_ids: [],
      employer_person_id: 'emp1',
      vessel_id: 'v1',
    }));
    mockFromAuth.mockReturnValueOnce(makePostingsChain(fullBatch));
    // vessel RPC for v1
    mockRpc.mockResolvedValue({
      data: [{ id: 'v1', name: 'Serenity', vessel_type: 'motor', size_band_id: 'sb1', size_band_label: '40-60m', nda_flag: false, loa_meters: 55, owner_person_id: 'emp1' }],
      error: null,
    });
    // poster profiles
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ person_id: 'emp1', display_name: 'Emp' }] }),
      }),
    });
    // cert names (no certs)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.has_more).toBe(true);
    expect(data.next_cursor).toBeTruthy();
  });

  it('applies salaryMin filter — returns 200 with salaryMin param', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    mockFromAuth.mockReturnValueOnce(makePostingsChain([]));

    const res = await GET(makeRequest({ salaryMin: '4000' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toEqual([]);
  });

  it('applies roleId filter — returns 200 with roleId param', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeSimpleChain([]));
    mockFromAuth.mockReturnValueOnce(makePostingsChain([]));

    const res = await GET(makeRequest({ roleId: 'r1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toEqual([]);
  });
});
