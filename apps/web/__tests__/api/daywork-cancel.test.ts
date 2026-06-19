import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/cancel/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/daywork/:id/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        ...guardOk().value,
        person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      },
    });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only employers');
  });

  it('returns 404 when daywork not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when not the poster', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'other', status: 'active' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'u1', status: 'completed' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful cancel from active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'u1', status: 'active' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'DAYWORK.CANCELLED_BY_EMPLOYER',
      }),
    );
  });

  it('returns 200 on successful cancel from in_progress', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'd1', poster_person_id: 'u1', status: 'in_progress' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
  });
});
