import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/onboarding/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockServiceFrom,
  })),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
const mockAppendEvents = vi.fn().mockResolvedValue(['evt-1', 'evt-2']);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

const validBody = {
  identityType: 'crew',
  currentHat: 'crew',
  profile: { displayName: 'Test User' },
};

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid identity type', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await POST(
      makeRequest({ ...validBody, identityType: 'captain' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid identity type');
  });

  it('returns 400 for invalid hat selection', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await POST(
      makeRequest({ ...validBody, identityType: 'agent', currentHat: 'crew' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid hat selection');
  });

  it('returns 400 for javascript: avatar URL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(
      makeRequest({
        ...validBody,
        profile: { displayName: 'Test', avatarUrl: 'javascript:alert(1)' },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('avatar URL');
  });

  it('accepts valid HTTPS avatar URL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({
        ...validBody,
        profile: { displayName: 'Test', avatarUrl: 'https://example.com/avatar.jpg' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 409 when already onboarded', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain({ id: 'u1' }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Already onboarded');
  });

  it('returns 200 on successful onboarding', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null)); // No existing person
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'onboard_person',
      expect.objectContaining({
        p_identity_type: 'crew',
        p_current_hat: 'crew',
        p_person_id: 'u1',
        p_profile: expect.objectContaining({
          display_name: 'Test User',
        }),
      }),
    );
  });

  it('passes green crew fields through to profile payload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({
      identityType: 'crew',
      currentHat: 'crew',
      profile: {
        displayName: 'Green Crew',
        shoreExperience: 'Bartender for 3 years',
        motivation: 'Want to work on yachts',
        languages: ['en', 'fr'],
        availableToStart: 'immediate',
        onboardingVersion: 2,
      },
    }));
    expect(res.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith(
      'onboard_person',
      expect.objectContaining({
        p_profile: expect.objectContaining({
          shore_experience: 'Bartender for 3 years',
          motivation: 'Want to work on yachts',
          languages: ['en', 'fr'],
          available_to_start: 'immediate',
          onboarding_version: 2,
        }),
      }),
    );
  });

  it('creates vessels and experiences during onboarding for experienced crew', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    // Existing crew_experiences lookup — none
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    // Vessel lookup — not found
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    // Size bands lookup
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'sb1', min_meters: 0, max_meters: 30 },
            { id: 'sb2', min_meters: 30, max_meters: 50 },
            { id: 'sb3', min_meters: 50, max_meters: null },
          ],
        }),
      }),
    });

    const res = await POST(makeRequest({
      identityType: 'crew',
      currentHat: 'crew',
      profile: {
        displayName: 'Experienced Crew',
        onboardingVersion: 2,
      },
      experiences: [{
        vessel: {
          imoNumber: '1234567',
          name: 'M/Y Test',
          vesselType: 'charter',
          loaMeters: 45,
        },
        experience: {
          roleId: 'r1',
          startDate: '2024-01-01',
          endDate: '2024-06-01',
          charterOrPrivate: 'charter',
          flagState: 'GBR',
          rotationType: '2:2',
        },
      }],
    }));
    expect(res.status).toBe(200);

    // Should have called appendEvents once with batch of 2 events: VESSEL.CREATED + EXPERIENCE.ADDED
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const batchEvents = mockAppendEvents.mock.calls[0][1];
    expect(batchEvents).toHaveLength(2);
    expect(batchEvents[0].eventType).toBe('VESSEL.CREATED');
    expect(batchEvents[1].eventType).toBe('EXPERIENCE.ADDED');
  });

  it('reuses existing vessel during onboarding if IMO matches', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    // Existing crew_experiences lookup — none
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    // Vessel lookup — found existing
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-v1' } }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({
      identityType: 'crew',
      currentHat: 'crew',
      profile: {
        displayName: 'Experienced Crew',
        onboardingVersion: 2,
      },
      experiences: [{
        vessel: {
          imoNumber: '1234567',
          name: 'M/Y Test',
          vesselType: 'charter',
          loaMeters: 45,
        },
        experience: {
          roleId: 'r1',
          startDate: '2024-01-01',
          charterOrPrivate: 'charter',
        },
      }],
    }));
    expect(res.status).toBe(200);

    // Only EXPERIENCE.ADDED, no VESSEL.CREATED — single event still uses appendEvents batch
    expect(mockAppendEvents).toHaveBeenCalledTimes(1);
    const batchEvents = mockAppendEvents.mock.calls[0][1];
    expect(batchEvents).toHaveLength(1);
    expect(batchEvents[0].eventType).toBe('EXPERIENCE.ADDED');
    expect(batchEvents[0].payload.vessel_id).toBe('existing-v1');
  });

  it('returns 409 when batch experiences overlap with existing crew_experiences', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    // Existing crew_experiences — overlaps with the batch entry
    mockServiceFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ start_date: '2024-03-01', end_date: '2024-09-01' }],
          error: null,
        }),
      }),
    });

    const res = await POST(makeRequest({
      identityType: 'crew',
      currentHat: 'crew',
      profile: { displayName: 'Overlap Crew', onboardingVersion: 2 },
      experiences: [{
        vessel: { imoNumber: '1234567', name: 'M/Y Test', vesselType: 'charter', loaMeters: 45 },
        experience: { roleId: 'r1', startDate: '2024-01-01', endDate: '2024-06-01', charterOrPrivate: 'charter' },
      }],
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('overlap');
  });

  it('passes deck name, desired role, and career status through to profile payload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({
      identityType: 'crew',
      currentHat: 'crew',
      profile: {
        displayName: 'Full Profile',
        deckName: 'Sparky',
        desiredRoleId: 'role-123',
        permanentAvailability: 'after_notice',
        noticePeriodDays: 14,
        currentlyEmployed: true,
      },
    }));
    expect(res.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith(
      'onboard_person',
      expect.objectContaining({
        p_profile: expect.objectContaining({
          deck_name: 'Sparky',
          desired_role_id: 'role-123',
          permanent_availability: 'after_notice',
          notice_period_days: 14,
          currently_employed: true,
        }),
      }),
    );
  });

  it('omits new optional fields gracefully when not provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith(
      'onboard_person',
      expect.objectContaining({
        p_profile: expect.objectContaining({
          deck_name: null,
          desired_role_id: null,
          permanent_availability: null,
          notice_period_days: null,
          currently_employed: false,
        }),
      }),
    );
  });

  it('agent with required fields succeeds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({
      identityType: 'agent',
      currentHat: 'agent',
      profile: { displayName: 'Agent Smith', agencyName: 'Top Crew Agency' },
    }));
    expect(res.status).toBe(200);
  });

  it('agent without agencyName returns 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await POST(makeRequest({
      identityType: 'agent',
      currentHat: 'agent',
      profile: { displayName: 'Agent Smith' },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Agency name');
  });
});
