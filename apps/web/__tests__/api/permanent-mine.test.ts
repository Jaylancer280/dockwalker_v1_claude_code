import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/permanent/mine/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...a: unknown[]) => mockRequireDomainUser(...a),
}));

const mockFrom = vi.fn();

function guardOk(userId = 'emp1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, current_hat: 'employer' },
      profile: {},
      supabase: { from: mockFrom },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePostingsChain(data: any[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data, error: null });
  return chain;
}

describe('GET /api/permanent/mine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    expect((await GET()).status).toBe(401);
  });

  it('returns 403 when hat is crew', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        user: { id: 'u1' },
        person: { id: 'u1', current_hat: 'crew' },
        profile: {},
        supabase: { from: mockFrom },
        serviceClient: { from: vi.fn(), rpc: vi.fn() },
      },
    });
    expect((await GET()).status).toBe(403);
  });

  it('returns empty array when no permanent postings', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce(makePostingsChain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toEqual([]);
  });

  it('returns postings with counts and selected_crew_name', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Postings query
    mockFrom.mockReturnValueOnce(
      makePostingsChain([
        {
          id: 'pp1',
          job_number: 1,
          status: 'in_negotiation',
          salary_min: 3000,
          salary_max: 5000,
          salary_currency: 'EUR',
          salary_period: 'monthly',
          yacht_roles: { name: 'Captain' },
          ports: { name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'French Riviera' } } },
          vessels: { name: 'Serenity', nda_flag: false, vessel_type: 'motor' },
          experience_brackets: { label: '2-5 years' },
        },
      ]),
    );
    // Application counts query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countChain: any = {};
    countChain.select = vi.fn().mockReturnValue(countChain);
    countChain.in = vi.fn().mockReturnValue(countChain);
    countChain.neq = vi.fn().mockResolvedValue({
      data: [
        { permanent_posting_id: 'pp1', status: 'applied' },
        { permanent_posting_id: 'pp1', status: 'shortlisted' },
        { permanent_posting_id: 'pp1', status: 'selected' },
      ],
    });
    mockFrom.mockReturnValueOnce(countChain);
    // Selected crew name query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedChain: any = {};
    selectedChain.select = vi.fn().mockReturnValue(selectedChain);
    selectedChain.in = vi.fn().mockReturnValue(selectedChain);
    selectedChain.eq = vi.fn().mockResolvedValue({
      data: [{ permanent_posting_id: 'pp1', profiles: { display_name: 'Crew One' } }],
    });
    mockFrom.mockReturnValueOnce(selectedChain);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.postings).toHaveLength(1);
    expect(data.postings[0].applicant_count).toBe(1);
    expect(data.postings[0].shortlist_count).toBe(2);
    expect(data.postings[0].total_applications).toBe(3);
    expect(data.postings[0].selected_crew_name).toBe('Crew One');
  });

  it('only returns postings owned by the user', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const chain = makePostingsChain([]);
    mockFrom.mockReturnValueOnce(chain);
    await GET();
    expect(chain.eq).toHaveBeenCalledWith('employer_person_id', 'emp1');
  });
});
