import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/[id]/applicants/route';

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
      serviceClient: { rpc: vi.fn(), from: mockFromAuth },
      ...overrides,
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/daywork/:id/applicants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
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

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(409);
  });

  it('returns 404 when daywork not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd1',
              poster_person_id: 'other',
              start_date: '2026-04-01',
              end_date: '2026-04-05',
            },
          }),
        }),
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('filters by certificationId on enriched profile data', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // daywork query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'd1', poster_person_id: 'u1', start_date: '2026-04-01', end_date: '2026-04-05' },
          }),
        }),
      }),
    });
    // applications — two applicants, only c1 has cert-123
    const apps = [
      { id: 'a1', crew_person_id: 'c1', status: 'applied', created_at: '2026-03-01', profiles: { certification_ids: ['cert-123', 'cert-456'] } },
      { id: 'a2', crew_person_id: 'c2', status: 'applied', created_at: '2026-03-02', profiles: { certification_ids: ['cert-789'] } },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // availability windows
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    });
    // past engagements
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    });
    // shore experience categories
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET(
      new Request('http://localhost?certificationId=cert-123'),
      makeParams('d1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].crew_person_id).toBe('c1');
  });

  it('filters by minAvailableDays on enriched availability data', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // daywork query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'd1', poster_person_id: 'u1', start_date: '2026-04-01', end_date: '2026-04-05' },
          }),
        }),
      }),
    });
    // applications — two applicants
    const apps = [
      { id: 'a1', crew_person_id: 'c1', status: 'applied', created_at: '2026-03-01' },
      { id: 'a2', crew_person_id: 'c2', status: 'applied', created_at: '2026-03-02' },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // availability — c1 has 3 days in range, c2 has 1 day
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({
            data: [
              { person_id: 'c1', date: '2026-04-01', city_id: null, not_available: false },
              { person_id: 'c1', date: '2026-04-02', city_id: null, not_available: false },
              { person_id: 'c1', date: '2026-04-03', city_id: null, not_available: false },
              { person_id: 'c2', date: '2026-04-01', city_id: null, not_available: false },
            ],
          }),
        }),
      }),
    });
    // past engagements
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    });
    // shore experience categories
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET(
      new Request('http://localhost?minAvailableDays=2'),
      makeParams('d1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].crew_person_id).toBe('c1');
    expect(body.applicants[0].available_days).toBe(3);
  });

  it('filters apply across both applied and shortlisted statuses', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // daywork query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'd1', poster_person_id: 'u1', start_date: '2026-04-01', end_date: '2026-04-05' },
          }),
        }),
      }),
    });
    // applications — one applied (has cert), one shortlisted (no cert)
    const apps = [
      { id: 'a1', crew_person_id: 'c1', status: 'applied', created_at: '2026-03-01', profiles: { certification_ids: ['cert-123'] } },
      { id: 'a2', crew_person_id: 'c2', status: 'shortlisted', created_at: '2026-03-02', profiles: { certification_ids: [] } },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // availability windows
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    });
    // past engagements
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
      }),
    });
    // shore experience categories
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });
    // B-003 Phase 2: shortlisted applicants trigger a references fetch.
    // Empty rows here so the route skips the downstream profiles + roles
    // resolution and proceeds with referencesByCrew = {}.
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(
      new Request('http://localhost?certificationId=cert-123'),
      makeParams('d1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Both statuses are in the response — filter removes c2 (shortlisted, no cert)
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].status).toBe('applied');
  });

  it('returns 200 with enriched applicants', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // daywork query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd1',
              poster_person_id: 'u1',
              start_date: '2026-04-01',
              end_date: '2026-04-05',
            },
          }),
        }),
      }),
    });
    // applications query
    const apps = [
      { id: 'a1', crew_person_id: 'c1', status: 'applied', created_at: '2026-03-01' },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // availability windows query (no date range filter — filtering done in JS)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // past engagements query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    // shore experience categories
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].available_days).toBe(0);
    expect(body.applicants[0].past_daywork_count).toBe(0);
  });

  it('cert_extras: components used to satisfy a required bundle are NOT extras (Stage 235c)', async () => {
    // Posting requires AEC 1+2 (the bundle). Applicant holds AEC 1 + AEC 2
    // separately. After Stage 235c the route should:
    //   - report cert_match.ok = true (symmetric direction)
    //   - report cert_extras_ids = [] (the two components are actively
    //     satisfying the bundle requirement, not over-qualification)
    const AEC_BUNDLE = 'cert-bundle';
    const AEC_1 = 'cert-aec-1';
    const AEC_2 = 'cert-aec-2';

    mockRequireDomainUser.mockResolvedValue(guardOk());
    // daywork query — requires the bundle
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd1',
              poster_person_id: 'u1',
              start_date: '2026-04-01',
              end_date: '2026-04-05',
              required_certification_ids: [AEC_BUNDLE],
            },
          }),
        }),
      }),
    });
    // applications query — applicant holds the two components separately
    const apps = [
      {
        id: 'a1',
        crew_person_id: 'c1',
        status: 'applied',
        created_at: '2026-03-01',
        profiles: { certification_ids: [AEC_1, AEC_2] },
      },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    // 4 parallel queries: availability, engagements, shore, bundles
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });
    // certification_components — bundle map (the pivotal mock)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: [
          { bundle_cert_id: AEC_BUNDLE, component_cert_id: AEC_1 },
          { bundle_cert_id: AEC_BUNDLE, component_cert_id: AEC_2 },
        ],
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants).toHaveLength(1);
    expect(body.applicants[0].cert_match?.ok).toBe(true);
    expect(body.applicants[0].cert_match?.missing_count).toBe(0);
    // The two components actively satisfy the bundle — not extras.
    expect(body.applicants[0].cert_extras_ids).toEqual([]);
    expect(body.applicants[0].cert_extras).toBe(0);
  });

  it('cert_extras: partial component holding leaves bundle missing AND keeps the held component as extra', async () => {
    // Posting requires AEC 1+2. Applicant only holds AEC 1. The bundle
    // stays unsatisfied (1-of-2 doesn't pass `every`), AND because AEC 1
    // alone doesn't cover the AEC 1+2 bundle requirement on its own
    // (direction 1 needs the bundle holding), AEC 1 isn't directly used.
    // Expected: cert_match.ok = false, cert_extras_ids = [] still (because
    // direction-2 partial set means the candidate isn't qualified at all,
    // and the route's logic treats AEC 1 as not covering anything).
    // Actually: with partial coverage, the direction-2 check fails, and
    // direction-1 (bundles[c]) returns undefined for AEC 1 (it's not a
    // bundle). The component IS still in the candidate's set, but it's
    // not contributing to a satisfied requirement. Per the route logic
    // it stays in extras since it doesn't match any requirement directly
    // or via either bundle direction.
    const AEC_BUNDLE = 'cert-bundle';
    const AEC_1 = 'cert-aec-1';
    const AEC_2 = 'cert-aec-2';

    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'd1',
              poster_person_id: 'u1',
              start_date: '2026-04-01',
              end_date: '2026-04-05',
              required_certification_ids: [AEC_BUNDLE],
            },
          }),
        }),
      }),
    });
    const apps = [
      {
        id: 'a1',
        crew_person_id: 'c1',
        status: 'applied',
        created_at: '2026-03-01',
        profiles: { certification_ids: [AEC_1] },
      },
    ];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: apps, error: null }),
          }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gt: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: [
          { bundle_cert_id: AEC_BUNDLE, component_cert_id: AEC_1 },
          { bundle_cert_id: AEC_BUNDLE, component_cert_id: AEC_2 },
        ],
      }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicants[0].cert_match?.ok).toBe(false);
    expect(body.applicants[0].cert_match?.missing_count).toBe(1);
    // AEC 1 alone does NOT satisfy the bundle, but it's still in the
    // candidate's holdings — the route reports it as an extra because
    // it's not contributing to any satisfied requirement.
    expect(body.applicants[0].cert_extras_ids).toEqual([AEC_1]);
  });
});
