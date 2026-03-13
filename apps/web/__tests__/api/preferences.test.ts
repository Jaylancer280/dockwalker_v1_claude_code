import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, PATCH } from '@/app/api/preferences/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/preferences', () => {
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

  it('returns defaults when no preferences row exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile_visible).toBe(true);
  });

  it('returns stored preferences when row exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { profile_visible: false }, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile_visible).toBe(false);
  });
});

describe('PATCH /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await PATCH(makeRequest({ profile_visible: false }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no valid fields provided', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({ invalid_field: 'whatever' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No valid fields to update');
  });

  it('upserts profile_visible preference', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });

    const res = await PATCH(makeRequest({ profile_visible: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_preferences');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 'u1',
        profile_visible: false,
      }),
      { onConflict: 'person_id' },
    );
  });

  it('ignores non-boolean profile_visible values', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(makeRequest({ profile_visible: 'yes' }));
    expect(res.status).toBe(400);
  });
});
