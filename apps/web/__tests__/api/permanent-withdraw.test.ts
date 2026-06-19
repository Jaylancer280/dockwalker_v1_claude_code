import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/withdraw/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'crew1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

const params = Promise.resolve({ id: 'pp1' });
const req = new Request('http://localhost/api/permanent/pp1/withdraw', { method: 'POST' });

describe('POST /api/permanent/:id/withdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppendEvent.mockResolvedValue('ev1');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it('returns 403 when hat is employer', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        user: { id: 'u1' },
        person: { id: 'u1', current_hat: 'employer' },
        profile: {},
        supabase: { from: mockFromAuth },
        serviceClient: { from: vi.fn(), rpc: vi.fn() },
      },
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 404 when no application exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 400 when application is in terminal state', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'not_selected' } }),
          }),
        }),
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('happy path — withdraws applied application', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'applied' } }),
          }),
        }),
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.WITHDRAWN');
  });

  it('happy path — withdraws shortlisted application', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'shortlisted' } }),
          }),
        }),
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
  });

  it('happy path — withdraws selected application (triggers engagement close)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'a1', status: 'selected' } }),
          }),
        }),
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.WITHDRAWN');
  });
});
