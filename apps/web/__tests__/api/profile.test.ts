import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/profile/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockFromService = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: vi.fn(),
    from: mockFromService,
  })),
}));

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when no person record exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('No profile found');
  });

  it('returns 200 with person and profile data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const personData = { id: 'u1', identity_type: 'crew', current_hat: 'crew' };
    const profileData = { person_id: 'u1', display_name: 'Test Crew' };

    mockFromAuth
      .mockReturnValueOnce(makeChain(personData))
      .mockReturnValueOnce(makeChain(profileData));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person).toEqual(personData);
    expect(body.profile).toEqual(profileData);
  });
});

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(makeRequest({ displayName: 'New' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'u1', identity_type: 'crew', current_hat: 'crew' })
    );

    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No fields to update');
  });
});
