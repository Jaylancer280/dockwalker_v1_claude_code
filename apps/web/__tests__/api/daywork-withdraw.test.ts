import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/withdraw/route';

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
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/daywork/:id/withdraw', () => {
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

  it('returns 404 when no application found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when application is in accepted state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'accepted' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('accepted');
  });

  it('returns 400 when application is in rejected state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'rejected' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('rejected');
  });

  it('returns 400 when application is in completed state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'completed' }),
    );

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('completed');
  });

  it('returns 200 on successful withdrawal from applied state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'applied' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'APPLICATION.WITHDRAWN' }),
    );
  });

  it('returns 200 on successful withdrawal from shortlisted state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'shortlisted' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'APPLICATION.WITHDRAWN' }),
    );
  });

  it('returns 200 on successful withdrawal from viewed state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({ id: 'app1', status: 'viewed' }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(new Request('http://localhost'), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'APPLICATION.WITHDRAWN' }),
    );
  });
});
