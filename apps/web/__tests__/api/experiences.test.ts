import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/experiences/route';
import { PATCH, DELETE } from '@/app/api/experiences/[id]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/experiences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/experiences', () => {
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

  it('returns 200 with experiences list', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const experiences = [
      {
        id: 'exp1',
        vessel_id: 'v1',
        role_id: 'r1',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        is_current: false,
        charter_or_private: 'charter',
        flag_state: 'GBR',
        rotation_type: '2:2',
        rotation_details: null,
        description: 'Deckhand on M/Y Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        vessels: { id: 'v1', imo_number: '1234567', name: 'M/Y Test', vessel_type: 'charter', size_band_id: 'sb1', loa_meters: 45, vessel_size_bands: { label: '40-50m' } },
        yacht_roles: { id: 'r1', label: 'Deckhand' },
      },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: experiences, error: null }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.experiences).toHaveLength(1);
    expect(body.experiences[0].id).toBe('exp1');
  });
});

describe('POST /api/experiences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required fields are missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({ vesselId: 'v1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid charterOrPrivate', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      charterOrPrivate: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid rotation type', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      charterOrPrivate: 'charter',
      rotationType: 'invalid',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for description over 250 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      charterOrPrivate: 'charter',
      description: 'x'.repeat(251),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await POST(jsonRequest({
      vesselId: 'v1',
      roleId: 'r1',
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      charterOrPrivate: 'charter',
      flagState: 'GBR',
      rotationType: '2:2',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.ADDED');
  });
});

describe('PATCH /api/experiences/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when experience not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 'r2' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful update', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: 'r2', charterOrPrivate: 'private' }),
    });
    const res = await PATCH(req, makeParams('exp1'));
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.UPDATED');
  });
});

describe('DELETE /api/experiences/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when experience not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('exp1'));
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful delete', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exp1' } }),
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/experiences/exp1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('exp1'));
    expect(res.status).toBe(200);
    expect(mockAppendEvent).toHaveBeenCalledOnce();
    expect(mockAppendEvent.mock.calls[0][1].eventType).toBe('EXPERIENCE.REMOVED');
  });
});
