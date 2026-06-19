import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, PATCH } from '@/app/api/profile/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
      ...overrides,
    },
  };
}

describe('GET /api/profile', () => {
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
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
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

  it('returns 200 with person and profile data', async () => {
    const personData = { id: 'u1', identity_type: 'crew', current_hat: 'crew' };
    const profileData = { person_id: 'u1', display_name: 'Test Crew' };

    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: personData }),
    );
    mockFromAuth.mockReturnValueOnce(makeChain(profileData));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person).toEqual(personData);
    // Multi-nationality (Fix 240): GET attaches `nationalities_all`
    // (empty array when no nationality_ids set on the profile).
    expect(body.profile).toEqual({ ...profileData, nationalities_all: [] });
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
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await PATCH(makeRequest({ displayName: 'New' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No fields to update');
  });

  it('returns 400 when display name is empty', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({ displayName: '   ' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Display name');
  });

  it('returns 400 when display name exceeds 100 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({ displayName: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('100');
  });

  it('allows display name of exactly 100 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await PATCH(makeRequest({ displayName: 'a'.repeat(100) }));
    expect(res.status).toBe(200);
  });

  it('returns 400 when bio exceeds 1000 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({ bio: 'b'.repeat(1001) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('1000');
  });

  it('allows bio of exactly 1000 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await PATCH(makeRequest({ bio: 'b'.repeat(1000) }));
    expect(res.status).toBe(200);
  });

  it('allows null bio to clear it', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await PATCH(makeRequest({ bio: null }));
    expect(res.status).toBe(200);
  });

  it('updates smoker and visibleTattoos', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await PATCH(makeRequest({ smoker: true, visibleTattoos: false }));
    expect(res.status).toBe(200);
  });

  it('agent clearing agencyName returns 400', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'agent', current_hat: 'agent' } }),
    );

    const res = await PATCH(makeRequest({ agencyName: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Agency name');
  });
});
