import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/messages/route';

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

// Mock for engagement queries: .select().eq() -> { data }
function makeEngagementChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data }),
    }),
  };
}

// Mock for messages query: .select().in().order() -> { data }
function makeMessagesChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

// Mock for ratings query: .select().eq().in() -> { data }
function makeRatingsChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

describe('GET /api/messages', () => {
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

  it('returns 409 when onboarding incomplete', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Complete onboarding before using this feature' },
        { status: 409 },
      ),
    });

    const res = await GET();
    expect(res.status).toBe(409);
  });

  it('returns 200 with conversations list including active engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const crewEngagements = [
      {
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        daywork_id: 'd1',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        status: 'active',
      },
    ];

    mockFromAuth
      .mockReturnValueOnce(makeEngagementChain(crewEngagements)) // as crew
      .mockReturnValueOnce(makeEngagementChain([]))              // as employer
      .mockReturnValueOnce(makeMessagesChain([]));               // messages

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].role).toBe('crew');
  });

  it('returns empty conversations when no engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    mockFromAuth
      .mockReturnValueOnce(makeEngagementChain([])) // as crew
      .mockReturnValueOnce(makeEngagementChain([])); // as employer

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toEqual([]);
  });

  it('keeps completed engagements visible until rated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const completedEngagement = {
      id: 'e2',
      crew_person_id: 'u1',
      employer_person_id: 'emp1',
      daywork_id: 'd2',
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      status: 'completed',
      crew_completion_status: 'confirmed',
    };

    mockFromAuth
      .mockReturnValueOnce(makeEngagementChain([completedEngagement])) // as crew
      .mockReturnValueOnce(makeEngagementChain([]))                    // as employer
      .mockReturnValueOnce(makeRatingsChain([]))                       // ratings (none yet)
      .mockReturnValueOnce(makeMessagesChain([]));                     // messages

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].status).toBe('completed');
  });

  it('marks completed engagements as rated when user has rated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const completedEngagement = {
      id: 'e2',
      crew_person_id: 'u1',
      employer_person_id: 'emp1',
      daywork_id: 'd2',
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      status: 'completed',
      crew_completion_status: 'confirmed',
    };

    mockFromAuth
      .mockReturnValueOnce(makeEngagementChain([completedEngagement])) // as crew
      .mockReturnValueOnce(makeEngagementChain([]))                    // as employer
      .mockReturnValueOnce(makeRatingsChain([{ engagement_id: 'e2' }])) // already rated
      .mockReturnValueOnce(makeMessagesChain([]));                     // messages

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].has_rated).toBe(true);
  });

  it('includes cancelled engagements', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const cancelledEngagement = {
      id: 'e3',
      crew_person_id: 'u1',
      employer_person_id: 'emp1',
      daywork_id: 'd3',
      start_date: '2026-02-01',
      end_date: '2026-02-05',
      status: 'cancelled',
    };

    mockFromAuth
      .mockReturnValueOnce(makeEngagementChain([cancelledEngagement])) // as crew
      .mockReturnValueOnce(makeEngagementChain([]))                    // as employer
      .mockReturnValueOnce(makeMessagesChain([]));                     // messages

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].status).toBe('cancelled');
  });
});
