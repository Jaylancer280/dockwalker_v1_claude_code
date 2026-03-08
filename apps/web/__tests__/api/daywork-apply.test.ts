import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/apply/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/daywork/d1/apply', {
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
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
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

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/daywork/:id/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest(), makeParams('d1'));
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

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(409);
  });

  it('returns 403 when not crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when daywork not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when posting is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', status: 'completed', poster_person_id: 'other' }),
    );

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when applying to own posting', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', status: 'active', poster_person_id: 'u1' }),
    );

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('own posting');
  });

  it('returns 409 when already applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', status: 'active', poster_person_id: 'other' }),
      )
      .mockReturnValueOnce(makeChain({ id: 'app1', status: 'applied' }));

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(409);
  });

  it('returns 200 on successful application', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', status: 'active', poster_person_id: 'other' }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ message: 'Keen!' }), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'DAYWORK.APPLIED',
        p_payload: expect.objectContaining({
          id: expect.any(String),
          daywork_id: 'd1',
          crew_person_id: 'u1',
          message: 'Keen!',
        }),
      }),
    );
  });

  it('succeeds without availability or profile matching', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({ id: 'd1', status: 'active', poster_person_id: 'other' }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(), makeParams('d1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
