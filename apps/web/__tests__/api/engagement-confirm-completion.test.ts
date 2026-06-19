import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/engagements/[id]/confirm-completion/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  const inner = { not: vi.fn(), single: vi.fn().mockResolvedValue({ data }) };
  inner.not.mockReturnValue(inner);
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(inner),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'crew1' },
      person: { id: 'crew1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'crew1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/engagements/:id/confirm-completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the crew member', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'other', daywork_id: 'd1',
        status: 'completed', crew_completion_status: null,
      }),
    );

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not completed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'active', crew_completion_status: null,
      }),
    );

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 409 when already confirmed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: 'confirmed',
      }),
    );

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(409);
  });

  it('returns 409 when already disputed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: 'disputed',
      }),
    );

    const res = await POST(makeRequest({ confirmed: false }), makeParams('e1'));
    expect(res.status).toBe(409);
  });

  it('returns 400 when confirmed is not a boolean', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: null,
      }),
    );

    const res = await POST(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('boolean');
  });

  it('returns 400 when body is malformed JSON', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: null,
      }),
    );

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 and emits COMPLETION_CONFIRMED when confirmed: true', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: null,
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ confirmed: true }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.COMPLETION_CONFIRMED' }),
    );
  });

  it('returns 200 and emits COMPLETION_DISPUTED when confirmed: false', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', daywork_id: 'd1',
        status: 'completed', crew_completion_status: null,
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest({ confirmed: false }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('disputed');
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.COMPLETION_DISPUTED' }),
    );
  });
});
