import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock flag to true so the underlying-behavior tests below exercise
// the route body (auth + crew-hat + 503 stub). The locked-state path
// (flag = false) is asserted in cv-routes-locked.test.ts.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: true,
  CV_BUILDER_LOCKED_PAYLOAD: {
    error: 'DockWalker CV — Coming Soon',
    message: 'CV Builder is currently disabled while we finalise the experience.',
  },
}));

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

import { POST } from '@/app/api/cv/generate/route';

function crewGuard(hat: 'crew' | 'employer' | 'agent' = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: hat },
      profile: { person_id: 'u1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: vi.fn() },
    },
  };
}

describe('POST /api/cv/generate (Stage-1 stub)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
    });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not on crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('employer'));
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/crew/i);
  });

  it('returns 503 with Coming-Soon payload for crew callers (Stage-1 stub)', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    const res = await POST();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Coming Soon/);
    expect(body.message).toMatch(/Settings/);
  });
});
