import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/permanent/[id]/apply/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('ev1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('@/lib/push-triggers', () => ({
  notifyOnEvent: vi.fn().mockResolvedValue(undefined),
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

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/permanent/pp1/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: 'pp1' });

describe('POST /api/permanent/:id/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppendEvent.mockResolvedValue('ev1');
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });
    const res = await POST(makeRequest(), { params });
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
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(403);
  });

  it('returns 404 when posting does not exist', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it('returns 400 when posting is filled', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'filled', required_certification_ids: [], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(400);
  });

  it('returns 409 when crew already applied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Posting query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'active', required_certification_ids: [], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    // Duplicate check
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'app1', status: 'applied' } }),
          }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(409);
  });

  it('returns 403 when crew missing required certs with missing_certs array', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Posting query — requires cert c1
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'active', required_certification_ids: ['c1', 'c2'], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    // Crew profile — has c2 but not c1 (queried in parallel with bundles)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { certification_ids: ['c2'] } }),
        }),
      }),
    });
    // certification_components — empty (no bundles defined in test)
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({ data: [] }),
    });
    // Cert name resolution
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'STCW' }] }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.missing_certs).toEqual([{ id: 'c1', name: 'STCW' }]);
  });

  it('cert block appends PERMANENT.APPLICATION_BLOCKED event', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'active', required_certification_ids: ['c1'], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { certification_ids: [] } }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({ data: [] }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'STCW' }] }),
      }),
    });
    await POST(makeRequest(), { params });
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.APPLICATION_BLOCKED');
  });

  it('cert hard-gate satisfied via bundle (AEC 1+2 covers AEC 1 + AEC 2)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Posting — requires AEC 1 (c1) and AEC 2 (c2) separately
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'pp1',
              status: 'active',
              required_certification_ids: ['c1', 'c2'],
              employer_person_id: 'emp1',
            },
          }),
        }),
      }),
    });
    // Crew has only the bundle cert (b1 = AEC 1+2), not c1 or c2 directly
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { certification_ids: ['b1'] } }),
        }),
      }),
    });
    // certification_components — b1 covers c1 and c2
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: [
          { bundle_cert_id: 'b1', component_cert_id: 'c1' },
          { bundle_cert_id: 'b1', component_cert_id: 'c2' },
        ],
      }),
    });
    // Duplicate check — no existing app
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    // Hard-gate should NOT 403 — bundle covers both components
    expect(res.status).not.toBe(403);
  });

  it('happy path — creates application and returns success', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // Posting — no certs required
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'active', required_certification_ids: [], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    // Duplicate check — no existing app
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('PERMANENT.APPLIED');
  });

  it('happy path with optional message', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'active', required_certification_ids: [], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    await POST(makeRequest({ message: 'I am interested in this role' }), { params });
    const payload = mockAppendEvent.mock.calls[0][1].payload;
    expect(payload.message).toBe('I am interested in this role');
  });

  it('crew can apply to posting in in_negotiation status', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pp1', status: 'in_negotiation', required_certification_ids: [], employer_person_id: 'emp1' } }),
        }),
      }),
    });
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(200);
  });
});
