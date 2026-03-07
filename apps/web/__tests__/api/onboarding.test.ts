import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/onboarding/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
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
});
