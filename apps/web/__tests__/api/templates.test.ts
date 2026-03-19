import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/daywork/templates/route';
import { GET as getOne, DELETE } from '@/app/api/daywork/templates/[id]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: {},
    },
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/daywork/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with templates list', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const templates = [{ id: 't1', name: 'My Template' }];
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: templates, error: null }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toEqual(templates);
  });
});

describe('POST /api/daywork/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid currency', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await POST(makeRequest({ name: 'Test', currency: 'BTC' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('currency');
  });

  it('returns 201 on successful creation', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 't1' },
            error: null,
          }),
        }),
      }),
    });

    const res = await POST(
      makeRequest({ name: 'My Template', roleId: 'r1' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('t1');
  });
});

describe('GET /api/daywork/templates/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await getOne(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when template not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'not found' },
            }),
          }),
        }),
      }),
    });

    const res = await getOne(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with template data', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const template = { id: 't1', name: 'My Template', role_id: 'r1' };
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: template,
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await getOne(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template).toEqual(template);
  });
});

describe('DELETE /api/daywork/templates/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful delete', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const res = await DELETE(new Request('http://localhost'), makeParams('t1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
