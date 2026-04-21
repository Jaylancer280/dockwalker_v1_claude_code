import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/permanent/[id]/review/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'emp1', hat = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, current_hat: hat },
      profile: {},
      supabase: { from: mockFromAuth },
      serviceClient: { from: mockFromAuth, rpc: vi.fn() },
    },
  };
}

const params = Promise.resolve({ id: 'pp1' });
const req = new Request('http://localhost/api/permanent/pp1/review');

describe('GET /api/permanent/:id/review', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns 403 when hat is crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('u1', 'crew'));
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 403 when not posting owner', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    // Posting owned by someone else
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'other', status: 'active', shortlist_cap: 5 } }),
        }),
      }),
    });
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns applicants with correct response shape', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    // Posting
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'active', shortlist_cap: 5 } }),
        }),
      }),
    });
    // Applications
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appsChain: any = {};
    appsChain.select = vi.fn().mockReturnValue(appsChain);
    appsChain.eq = vi.fn().mockReturnValue(appsChain);
    appsChain.in = vi.fn().mockReturnValue(appsChain);
    appsChain.order = vi.fn().mockResolvedValue({
      data: [{
        id: 'a1', crew_person_id: 'c1', status: 'applied', message: 'Hi', created_at: '2026-03-20', source: 'direct',
        profiles: { display_name: 'Crew One', bio: null, avatar_url: null, yacht_roles: { name: 'Deckhand', department: 'deck' }, experience_brackets: { label: '2-5 years' }, ports: null, nationalities: null, permanent_availability: 'immediate', notice_period_days: null, currently_employed: false, certification_ids: [], vessel_size_exposure_ids: [], nationality_id: null, entry_right_ids: [] },
      }],
      error: null,
    });
    mockFromAuth.mockReturnValueOnce(appsChain);
    // Shore experiences query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            { person_id: 'c1', shore_experience_categories: { name: 'Hospitality' } },
            { person_id: 'c1', shore_experience_categories: { name: 'Fitness' } },
          ],
        }),
      }),
    });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.applicants).toHaveLength(1);
    expect(data.shortlist_cap).toBe(5);
    expect(data.shortlist_count).toBe(0);
    expect(data.posting_status).toBe('active');
    expect(data.selected_crew_id).toBeNull();
    expect(data.applicants[0].display_name).toBe('Crew One');
    expect(data.applicants[0].permanent_availability).toBe('immediate');
    expect(data.applicants[0].shore_experience_categories).toEqual(['Hospitality', 'Fitness']);
  });

  it('includes shortlist_cap, shortlist_count, posting_status', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', employer_person_id: 'emp1', status: 'in_negotiation', shortlist_cap: 3 } }),
        }),
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appsChain: any = {};
    appsChain.select = vi.fn().mockReturnValue(appsChain);
    appsChain.eq = vi.fn().mockReturnValue(appsChain);
    appsChain.in = vi.fn().mockReturnValue(appsChain);
    appsChain.order = vi.fn().mockResolvedValue({
      data: [
        { id: 'a1', crew_person_id: 'c1', status: 'shortlisted', message: null, created_at: '2026-03-20', source: null, profiles: { display_name: 'C1', yacht_roles: null, experience_brackets: null, ports: null, nationalities: null } },
        { id: 'a2', crew_person_id: 'c2', status: 'selected', message: null, created_at: '2026-03-20', source: null, profiles: { display_name: 'C2', yacht_roles: null, experience_brackets: null, ports: null, nationalities: null } },
      ],
      error: null,
    });
    mockFromAuth.mockReturnValueOnce(appsChain);
    // Shore experiences query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.shortlist_cap).toBe(3);
    expect(data.shortlist_count).toBe(2);
    expect(data.posting_status).toBe('in_negotiation');
    expect(data.selected_crew_id).toBe('c2');
  });
});
