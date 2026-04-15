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
});
