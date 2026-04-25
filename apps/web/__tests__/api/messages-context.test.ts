import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/messages/[engagementId]/context/route';

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
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

function makeChain(data: unknown) {
  const eqFn: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data }),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  });
  // Support chaining multiple .eq() calls (e.g. .eq('a', 1).eq('b', 2).single())
  eqFn.mockReturnValue({
    eq: eqFn,
    single: vi.fn().mockResolvedValue({ data }),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  });
  return {
    select: vi.fn().mockReturnValue({
      eq: eqFn,
    }),
  };
}

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

describe('GET /api/messages/:engagementId/context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
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

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(409);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'c1',
        employer_person_id: 'emp1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
      }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with engagement context and other name', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
        }),
      )
      .mockReturnValueOnce(makeChain({ display_name: 'Captain Smith' }))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.other_name).toBe('Captain Smith');
    expect(body.engagement.has_rated).toBe(false);
    expect(body.engagement.my_rating).toBeNull();
    expect(body.engagement.checklist).toBeNull();
  });

  it('returns Unknown when other profile not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
        }),
      )
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.other_name).toBe('Unknown');
    expect(body.engagement.has_rated).toBe(false);
  });

  it('returns has_rated true with my_rating when user has already rated', async () => {
    const ratingData = {
      id: 'rating1',
      rater_role: 'employer',
      pay_accuracy: null,
      meals_accuracy: null,
      role_accuracy: null,
      working_days_accuracy: null,
      vessel_condition: null,
      would_work_on_vessel_again: null,
      skills_as_advertised: 'yes',
      certifications_verified: 'yes',
      punctuality: 'yes',
      would_rehire: true,
      communication_accuracy: true,
      overall_match: 4,
    };
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          start_date: '2026-04-01',
          end_date: '2026-04-05',
        }),
      )
      .mockReturnValueOnce(makeChain({ display_name: 'Captain Smith' }))
      .mockReturnValueOnce(makeChain(ratingData))
      .mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.has_rated).toBe(true);
    expect(body.engagement.my_rating).toEqual(ratingData);
  });
});
