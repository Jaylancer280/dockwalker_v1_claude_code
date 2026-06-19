import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET as searchGET } from '@/app/api/locations/search/route';
import { GET as topGET } from '@/app/api/locations/top/route';
import { GET as byIdsGET } from '@/app/api/locations/by-ids/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-auth-session', () => ({
  requireAuthSession: () => mockRequireDomainUser(),
}));

const mockRpc = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      supabase: { rpc: mockRpc },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/locations/search', () => {
  it('401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await searchGET(new Request('http://localhost/api/locations/search?q=gocek'));
    expect(res.status).toBe(401);
  });

  it('returns empty results when q is under 2 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await searchGET(new Request('http://localhost/api/locations/search?q=g'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('passes the query to search_locations RPC and returns results', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'port-1',
          kind: 'port',
          name: 'D-Marin Gocek',
          parent_id: 'city-1',
          parent_name: 'Gocek',
          country_code: 'TR',
          score: 0.85,
        },
      ],
      error: null,
    });
    const res = await searchGET(new Request('http://localhost/api/locations/search?q=gocek'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].name).toBe('D-Marin Gocek');
    expect(mockRpc).toHaveBeenCalledWith('search_locations', { q: 'gocek' });
  });

  it('returns 500 when RPC errors', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await searchGET(new Request('http://localhost/api/locations/search?q=antibes'));
    expect(res.status).toBe(500);
  });
});

describe('GET /api/locations/top', () => {
  it('clamps limit to the allowed range and calls top_locations', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ data: [], error: null });
    await topGET(new Request('http://localhost/api/locations/top?limit=99999'));
    expect(mockRpc).toHaveBeenCalledWith('top_locations', { port_limit: 200 });
  });

  it('defaults limit to 50 when omitted', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ data: [], error: null });
    await topGET(new Request('http://localhost/api/locations/top'));
    expect(mockRpc).toHaveBeenCalledWith('top_locations', { port_limit: 50 });
  });

  it('enforces a minimum limit of 1', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ data: [], error: null });
    await topGET(new Request('http://localhost/api/locations/top?limit=0'));
    expect(mockRpc).toHaveBeenCalledWith('top_locations', { port_limit: 1 });
  });
});

describe('GET /api/locations/by-ids', () => {
  it('returns empty results when no IDs supplied', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const res = await byIdsGET(new Request('http://localhost/api/locations/by-ids'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('filters invalid UUIDs before calling the RPC', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({ data: [], error: null });
    const valid1 = '00000000-0000-0000-0000-000000000001';
    const valid2 = '00000000-0000-0000-0000-000000000002';
    await byIdsGET(
      new Request(
        `http://localhost/api/locations/by-ids?ports=${valid1},not-a-uuid&cities=${valid2}`,
      ),
    );
    expect(mockRpc).toHaveBeenCalledWith('get_locations_by_ids', {
      port_ids: [valid1],
      city_ids: [valid2],
    });
  });

  it('returns results from the RPC', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockRpc.mockResolvedValue({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          kind: 'port',
          name: 'Port Vauban',
          city_id: 'c1',
          city_name: 'Antibes',
          region_id: 'r1',
          region_name: 'France',
          country_code: 'FR',
        },
      ],
      error: null,
    });
    const res = await byIdsGET(
      new Request(
        'http://localhost/api/locations/by-ids?ports=00000000-0000-0000-0000-000000000001',
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].name).toBe('Port Vauban');
  });
});
