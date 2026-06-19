import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/permanent/templates/route';
import { DELETE } from '@/app/api/permanent/templates/[id]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockRequireSubscription = vi.fn();
vi.mock('@/lib/require-subscription', () => ({
  requireSubscription: (...args: unknown[]) => mockRequireSubscription(...args),
}));

const mockFromAuth = vi.fn();

function guardOk(userId = 'emp1', hat: 'employer' | 'agent' = 'employer') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: hat },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { from: vi.fn(), rpc: vi.fn() },
    },
  };
}

describe('Permanent templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns empty array when no templates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.templates).toEqual([]);
  });

  it('POST creates template, returns id (pro — unlimited)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRequireSubscription.mockResolvedValue({ ok: true, plan: 'employer_pro' });
    mockFromAuth.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 't1' }, error: null }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/permanent/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: 'My Template',
        vesselId: 'v1',
        roleId: 'r1',
        locationPortId: 'p1',
        salaryMin: 3000,
        salaryMax: 5000,
        salaryCurrency: 'EUR',
        salaryPeriod: 'monthly',
        liveAboard: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('t1');
  });

  it('DELETE removes template', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/permanent/templates/t1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 't1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('POST returns 402 when free employer hits 1 PM template limit', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRequireSubscription.mockResolvedValue({ ok: false, response: null });
    // Count query returns 1 existing template
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1 }),
      }),
    });

    const req = new Request('http://localhost/api/permanent/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateName: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe('template_limit_reached');
    expect(data.limit).toBe(1);
  });

  it('ownership gating — returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
