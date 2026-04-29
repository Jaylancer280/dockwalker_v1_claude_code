import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/permanent/[id]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockSupabaseFrom = vi.fn();
const mockServiceFrom = vi.fn();

function singleChain(data: unknown, error: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockResolvedValue({ data, error });
  self.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return self;
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'crew-1' },
      person: { id: 'crew-1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'crew-1' },
      supabase: { from: mockSupabaseFrom },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function makeRequest(query = '') {
  return new Request(`http://localhost/api/permanent/post-1${query}`, { method: 'GET' });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const POSTING = {
  id: 'post-1',
  status: 'active',
  start_date: '2026-06-01',
  salary_min: 4000,
  salary_max: 5000,
  salary_currency: 'EUR',
  salary_period: 'monthly',
  live_aboard: true,
  contract_type: 'permanent',
  description: 'A great role',
  notes: null,
  required_certification_ids: [],
  yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
  vessels: { id: 'v1', name: 'M/Y Serenity', vessel_type: 'motor', nda_flag: false },
  ports: { id: 'p1', name: 'Port Hercule', cities: { name: 'Monaco' } },
};

describe('GET /api/permanent/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('404s when posting is missing', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(null, { code: 'PGRST116' }));
    const res = await GET(makeRequest(), makeParams('post-1'));
    expect(res.status).toBe(404);
  });

  it('returns posting with invitation:null when no from_invitation query param', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    const res = await GET(makeRequest(), makeParams('post-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posting.id).toBe('post-1');
    expect(body.invitation).toBeNull();
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it('returns invitation context when from_invitation is valid (status pending, posting+crew match)', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom
      .mockReturnValueOnce(
        singleChain({
          id: 'inv-1',
          message: 'Hi Sophie',
          status: 'pending',
          permanent_posting_id: 'post-1',
          crew_person_id: 'crew-1',
          invited_by_person_id: 'cap-1',
        }),
      )
      .mockReturnValueOnce(singleChain({ display_name: 'Captain James' }));

    const res = await GET(makeRequest('?from_invitation=inv-1'), makeParams('post-1'));
    const body = await res.json();
    expect(body.invitation).toEqual({
      id: 'inv-1',
      message: 'Hi Sophie',
      captain_name: 'Captain James',
    });
  });

  it('returns invitation:null when invitation is for a different posting', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(
      singleChain({
        id: 'inv-1',
        message: null,
        status: 'pending',
        permanent_posting_id: 'post-OTHER',
        crew_person_id: 'crew-1',
        invited_by_person_id: 'cap-1',
      }),
    );

    const res = await GET(makeRequest('?from_invitation=inv-1'), makeParams('post-1'));
    const body = await res.json();
    expect(body.invitation).toBeNull();
  });

  it('returns invitation:null when invitation is addressed to a different crew', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(
      singleChain({
        id: 'inv-1',
        message: null,
        status: 'pending',
        permanent_posting_id: 'post-1',
        crew_person_id: 'someone-else',
        invited_by_person_id: 'cap-1',
      }),
    );

    const res = await GET(makeRequest('?from_invitation=inv-1'), makeParams('post-1'));
    const body = await res.json();
    expect(body.invitation).toBeNull();
  });

  it('returns invitation:null when invitation status is not pending', async () => {
    mockSupabaseFrom.mockReturnValueOnce(singleChain(POSTING));
    mockServiceFrom.mockReturnValueOnce(
      singleChain({
        id: 'inv-1',
        message: null,
        status: 'expired',
        permanent_posting_id: 'post-1',
        crew_person_id: 'crew-1',
        invited_by_person_id: 'cap-1',
      }),
    );

    const res = await GET(makeRequest('?from_invitation=inv-1'), makeParams('post-1'));
    const body = await res.json();
    expect(body.invitation).toBeNull();
  });
});
