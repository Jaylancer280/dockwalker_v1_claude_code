import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/admin/canonical/[table]/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

vi.mock('@dockwalker/db', () => ({
  appendEvent: vi.fn().mockResolvedValue('evt-1'),
}));

const mockServiceFrom = vi.fn();

function adminOk() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: 'admin-1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

const makeParams = (table: string) => ({ params: Promise.resolve({ table }) });

describe('Admin canonical API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await GET(new Request('http://localhost'), makeParams('ports'));
    expect(res.status).toBe(403);
  });

  it('rejects invalid table names', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const res = await GET(new Request('http://localhost'), makeParams('events'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid table');
  });

  it('GET returns all rows for valid table (legacy unpaginated path)', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'r1', name: 'Deckhand' }],
          error: null,
        }),
      }),
    });
    const res = await GET(new Request('http://localhost'), makeParams('yacht_roles'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    // Legacy response shape — no pagination metadata
    expect(body.total).toBeUndefined();
    expect(body.page).toBeUndefined();
  });

  it('GET paginates when ?page= is present and returns pagination metadata', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    // Paginated path uses: .from(t).select(..., { count: 'exact' }).order(c).range(a,b)
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ id: 'p1', name: 'Antibes' }],
      count: 101,
      error: null,
    });
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range: rangeMock }),
      }),
    });
    const res = await GET(
      new Request('http://localhost/api/admin/canonical/ports?page=2&pageSize=50'),
      makeParams('ports'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(101);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(50);
    expect(body.totalPages).toBe(3);
    // Range offset for page 2 with pageSize 50 → 50..99
    expect(rangeMock).toHaveBeenCalledWith(50, 99);
  });

  it('GET caps pageSize at 500 to prevent runaway queries', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const rangeMock = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range: rangeMock }),
      }),
    });
    await GET(
      new Request('http://localhost/api/admin/canonical/ports?page=1&pageSize=99999'),
      makeParams('ports'),
    );
    // pageSize=500 means range(0, 499)
    expect(rangeMock).toHaveBeenCalledWith(0, 499);
  });

  it('GET uses `label` sort column for experience_brackets and vessel_size_bands', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ id: 'b1', label: '0–2 years' }],
      error: null,
    });
    mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ order: orderMock }),
    });
    await GET(new Request('http://localhost'), makeParams('experience_brackets'));
    expect(orderMock).toHaveBeenCalledWith('label');
  });

  it('POST creates record and returns 201', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-1', name: 'New Port' },
            error: null,
          }),
        }),
      }),
    });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Port', city_id: 'c1' }),
    });
    const res = await POST(req, makeParams('ports'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.record.name).toBe('New Port');
  });
});
