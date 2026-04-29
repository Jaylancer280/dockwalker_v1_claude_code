import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: () => mockRequireDomainUser(),
}));

// CV Builder is hard-locked behind a Coming-Soon gate at the user level
// (2026-04-29). The existing tests cover the underlying behaviour for
// when Stage 2 unlocks the flag — mock the flag to `true` so the route
// reaches its real validation logic. The locked-state behaviour is
// covered in `cv-settings-locked.test.ts`.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: true,
  CV_BUILDER_LOCKED_PAYLOAD: { error: 'locked', message: 'locked' },
}));

import { PATCH } from '@/app/api/cv/settings/route';

const mockServiceFrom = vi.fn();

function crewGuard(hat: 'crew' | 'employer' | 'agent' = 'crew') {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: hat },
      profile: { person_id: 'u1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function patchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/cv/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Profile UPDATE chain — terminates at .eq() returning a Promise.
function profileUpdateChain(error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue({ error });
  return chain;
}

// References / experiences UPDATE chain — terminates at .select() returning data.
function rowUpdateChain(data: unknown[] | null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

describe('PATCH /api/cv/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }),
    });
    const res = await PATCH(patchRequest({ cvIncludeSeaTime: true }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not on crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('employer'));
    const res = await PATCH(patchRequest({ cvIncludeSeaTime: true }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when body has no recognised toggle field', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    const res = await PATCH(patchRequest({}));
    expect(res.status).toBe(400);
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it('updates profiles.cv_include_sea_time when body has cvIncludeSeaTime', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    const chain = profileUpdateChain();
    mockServiceFrom.mockReturnValue(chain);

    const res = await PATCH(patchRequest({ cvIncludeSeaTime: true }));
    expect(res.status).toBe(200);
    expect(mockServiceFrom).toHaveBeenCalledWith('profiles');
    expect(chain.update).toHaveBeenCalledWith({ cv_include_sea_time: true });
    expect(chain.eq).toHaveBeenCalledWith('person_id', 'u1');
  });

  it('returns 500 when profile UPDATE errors', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    mockServiceFrom.mockReturnValue(profileUpdateChain({ message: 'db down' }));

    const res = await PATCH(patchRequest({ cvIncludeSeaTime: true }));
    expect(res.status).toBe(500);
  });

  it('updates references.include_on_cv when body has referenceId + includeOnCv', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    const chain = rowUpdateChain([{ id: 'ref-1' }]);
    mockServiceFrom.mockReturnValue(chain);

    const res = await PATCH(
      patchRequest({ referenceId: 'ref-1', includeOnCv: true }),
    );
    expect(res.status).toBe(200);
    expect(mockServiceFrom).toHaveBeenCalledWith('references');
    expect(chain.update).toHaveBeenCalledWith({ include_on_cv: true });
    // eq called for id, requester_person_id, status — order matters for the chain
    expect(chain.eq).toHaveBeenCalledWith('id', 'ref-1');
    expect(chain.eq).toHaveBeenCalledWith('requester_person_id', 'u1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'accepted');
  });

  it('returns 404 when reference is not owned or not accepted', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    mockServiceFrom.mockReturnValue(rowUpdateChain([])); // 0 rows updated

    const res = await PATCH(
      patchRequest({ referenceId: 'ref-not-mine', includeOnCv: false }),
    );
    expect(res.status).toBe(404);
  });

  it('updates crew_experiences.cv_show_full_vessel when body has experienceId + cvShowFullVessel', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    const chain = rowUpdateChain([{ id: 'exp-1' }]);
    mockServiceFrom.mockReturnValue(chain);

    const res = await PATCH(
      patchRequest({ experienceId: 'exp-1', cvShowFullVessel: false }),
    );
    expect(res.status).toBe(200);
    expect(mockServiceFrom).toHaveBeenCalledWith('crew_experiences');
    expect(chain.update).toHaveBeenCalledWith({ cv_show_full_vessel: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'exp-1');
    expect(chain.eq).toHaveBeenCalledWith('person_id', 'u1');
  });

  it('returns 404 when experience is not owned by caller', async () => {
    mockRequireDomainUser.mockResolvedValue(crewGuard('crew'));
    mockServiceFrom.mockReturnValue(rowUpdateChain([])); // 0 rows

    const res = await PATCH(
      patchRequest({ experienceId: 'exp-other', cvShowFullVessel: true }),
    );
    expect(res.status).toBe(404);
  });
});
