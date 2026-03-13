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
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
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

    // Should have called appendEvent twice: once for VESSEL.CREATED, once for EXPERIENCE.ADDED
    expect(mockAppendEvent).toHaveBeenCalledTimes(2);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('VESSEL.CREATED');
    expect(mockAppendEvent.mock.calls[1][1].eventType).toBe('EXPERIENCE.ADDED');
  });

  it('reuses existing vessel during onboarding if IMO matches', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

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

    // Only EXPERIENCE.ADDED, no VESSEL.CREATED
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.ADDED');
    expect(mockAppendEvent.mock.calls[0][1].payload.vessel_id).toBe('existing-v1');
  });
});
