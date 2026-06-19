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
  const eqFn: ReturnType<typeof vi.fn> = vi.fn();
  const limitFn: ReturnType<typeof vi.fn> = vi.fn();
  const terminal = {
    eq: eqFn,
    limit: limitFn,
    single: vi.fn().mockResolvedValue({ data }),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };
  // Support chaining multiple .eq()/.limit() calls before .single()/.maybeSingle()
  eqFn.mockReturnValue(terminal);
  limitFn.mockReturnValue(terminal);
  return {
    select: vi.fn().mockReturnValue(terminal),
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

  // 00130 — NDA masking on reference-contact engagement chat header.
  function makeRefContactEngagement(callerIs: 'employer' | 'referee') {
    return {
      id: 'e1',
      reference_contact_id: 'rc1',
      crew_person_id: callerIs === 'referee' ? 'u1' : 'reqperson',
      employer_person_id: callerIs === 'employer' ? 'u1' : 'empperson',
      start_date: null,
      end_date: null,
    };
  }

  function makeContactRow(opts: { vesselId: string | null }): unknown {
    return {
      id: 'rc1',
      reference_id: 'ref1',
      references: [
        {
          status: 'accepted',
          revoke_reason: null,
          requester_person_id: 'reqperson',
          vessel_id: opts.vesselId,
          snapshot_vessel_name: 'Top Secret',
          snapshot_vessel_imo: '7654321',
          snapshot_start_date: '2024-01-01',
          snapshot_end_date: '2024-12-31',
          requester_role_at_time: 'Bosun',
          claimed_referee_role: 'Captain',
          comment: null,
        },
      ],
    };
  }

  it('00130: referee in reference-contact chat sees full NDA snapshot', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(makeRefContactEngagement('referee')))
      .mockReturnValueOnce(makeChain({ display_name: 'Stress Employer' })) // otherProfile
      .mockReturnValueOnce(makeChain(null)) // myRating
      .mockReturnValueOnce(makeChain(null)) // checklist
      .mockReturnValueOnce(makeChain(makeContactRow({ vesselId: 'v-nda' }))) // contactRow
      .mockReturnValueOnce(makeChain({ display_name: 'Stress Requester' })) // requester profile
      .mockReturnValueOnce(makeChain({ nda_flag: true })); // vessel nda check

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.reference_context).toBeDefined();
    expect(body.engagement.reference_context.snapshot_vessel_name).toBe('Top Secret');
    expect(body.engagement.reference_context.snapshot_vessel_imo).toBe('7654321');
  });

  it('00130: employer in reference-contact chat sees masked NDA snapshot when not engaged', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(makeRefContactEngagement('employer')))
      .mockReturnValueOnce(makeChain({ display_name: 'Captain Smith' })) // otherProfile
      .mockReturnValueOnce(makeChain(null)) // myRating
      .mockReturnValueOnce(makeChain(null)) // checklist
      .mockReturnValueOnce(makeChain(makeContactRow({ vesselId: 'v-nda' }))) // contactRow
      .mockReturnValueOnce(makeChain({ display_name: 'Stress Requester' })) // requester profile
      .mockReturnValueOnce(makeChain({ nda_flag: true })) // vessel nda check
      .mockReturnValueOnce(makeChain(null)) // active_engagements daywork hit (none)
      .mockReturnValueOnce(makeChain(null)); // active_engagements permanent hit (none)

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.reference_context.snapshot_vessel_name).toBe('NDA Vessel');
    expect(body.engagement.reference_context.snapshot_vessel_imo).toBe('');
  });

  it('00130: employer with active engagement on the NDA vessel sees full snapshot', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(makeChain(makeRefContactEngagement('employer')))
      .mockReturnValueOnce(makeChain({ display_name: 'Captain Smith' }))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain(makeContactRow({ vesselId: 'v-nda' })))
      .mockReturnValueOnce(makeChain({ display_name: 'Stress Requester' }))
      .mockReturnValueOnce(makeChain({ nda_flag: true }))
      .mockReturnValueOnce(makeChain({ id: 'eng-active' })) // daywork engagement hit
      .mockReturnValueOnce(makeChain(null)); // permanent engagement (none)

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engagement.reference_context.snapshot_vessel_name).toBe('Top Secret');
    expect(body.engagement.reference_context.snapshot_vessel_imo).toBe('7654321');
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
