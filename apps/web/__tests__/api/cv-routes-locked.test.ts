import { describe, it, expect, vi } from 'vitest';

// Feature flag is hard-locked off (default state). These tests prove
// every gated route returns 503 with the Coming-Soon payload BEFORE
// any auth / parsing / DB work runs.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: false,
  CV_BUILDER_LOCKED_PAYLOAD: {
    error: 'DockWalker CV — Coming Soon',
    message: 'CV Builder is currently disabled while we finalise the experience.',
  },
}));

// Spy on requireDomainUser — it should NOT be called when the flag is
// off (the lock fires above the auth guard).
const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

// Defensive mocks: if the flag check fails and the route reaches its
// real body, these prevent attempts to reach Supabase / dependencies
// that aren't relevant to the locked-state assertion.
vi.mock('@dockwalker/db', () => ({
  appendEvent: vi.fn(),
  appendEvents: vi.fn(),
}));
vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  getQrHireLimit: () => ({ limit: vi.fn() }),
  getCvHandleAuthLimit: () => ({ limit: vi.fn() }),
  getCvHandleAnonLimit: () => ({ limit: vi.fn() }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { PATCH as cvSettingsPatch } from '@/app/api/cv/settings/route';
import { GET as cvHandleGet } from '@/app/api/cv/[handle]/route';
import { POST as permanentInvitePost } from '@/app/api/permanent/[id]/invite/route';

function jsonRequest(url: string, body: unknown = {}, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('CV Builder routes — locked-state (CV_BUILDER_ENABLED = false)', () => {
  it('PATCH /api/cv/settings → 503 with Coming-Soon payload', async () => {
    const res = await cvSettingsPatch(
      jsonRequest('http://localhost/api/cv/settings', { cvIncludeSeaTime: true }, 'PATCH'),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Coming Soon/);
    // The flag check must fire BEFORE auth — the test would otherwise
    // need a valid mocked user.
    expect(mockRequireDomainUser).not.toHaveBeenCalled();
  });

  it('GET /api/cv/[handle] → 503 with Coming-Soon payload (handle not even validated)', async () => {
    const res = await cvHandleGet(
      new Request('http://localhost/api/cv/AbCd1234'),
      { params: Promise.resolve({ handle: 'AbCd1234' }) },
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Coming Soon/);
  });

  it('GET /api/cv/[handle] → 503 even with invalid handle format (lock fires first)', async () => {
    const res = await cvHandleGet(
      new Request('http://localhost/api/cv/not-a-valid-handle'),
      { params: Promise.resolve({ handle: 'not-a-valid-handle' }) },
    );
    expect(res.status).toBe(503);
  });

  it('POST /api/permanent/[id]/invite → 503 with Coming-Soon payload', async () => {
    const res = await permanentInvitePost(
      jsonRequest('http://localhost/api/permanent/p-1/invite', { crewPersonId: 'c-1' }),
      { params: Promise.resolve({ id: 'p-1' }) },
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Coming Soon/);
    expect(mockRequireDomainUser).not.toHaveBeenCalled();
  });
});
