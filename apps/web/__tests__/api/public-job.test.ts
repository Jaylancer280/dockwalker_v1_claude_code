import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/jobs/[jobNumber]/route';

const mockServiceFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () =>
    Promise.resolve({
      from: mockServiceFrom,
    }),
}));

const makeParams = (jobNumber: string) => ({ params: Promise.resolve({ jobNumber }) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [], error }).then(resolve);
  return chain;
}

describe('GET /api/jobs/[jobNumber]', () => {
  it('returns 404 for malformed job number', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('INVALID'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for wrong prefix', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('XX-00001'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when daywork not found or inactive', async () => {
    mockServiceFrom.mockReturnValueOnce(mockChain(null));
    const res = await GET(new Request('http://localhost'), makeParams('DW-00001'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with correct shape for active daywork', async () => {
    // Daywork query
    mockServiceFrom.mockReturnValueOnce(
      mockChain({
        id: 'd1',
        job_number: 1,
        status: 'active',
        start_date: '2099-01-01',
        end_date: '2099-01-03',
        working_days: 3,
        day_rate: 250,
        currency: 'EUR',
        meals: ['breakfast'],
        notes: 'Test notes',
        positions_available: 1,
        permanent_opportunity: false,
        required_languages: ['English'],
        vessel_id: 'v1',
        role_id: 'r1',
        location_port_id: 'p1',
        required_certification_ids: ['c1'],
        experience_bracket_id: 'e1',
        created_at: '2099-01-01T00:00:00Z',
      }),
    );
    // Role query
    mockServiceFrom.mockReturnValueOnce(mockChain({ name: 'Deckhand', department: 'deck' }));
    // Port query
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'Antibes' } } }),
    );
    // Experience bracket
    mockServiceFrom.mockReturnValueOnce(mockChain({ label: 'Junior' }));
    // Vessel
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'M/Y Test', vessel_type: 'motor', loa_meters: 45, nda_flag: false, vessel_size_bands: { label: '40-60m' } }),
    );
    // Certs
    mockServiceFrom.mockReturnValueOnce(mockChain([{ name: 'STCW' }]));

    const res = await GET(new Request('http://localhost'), makeParams('DW-00001'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job_number).toBe('DW-00001');
    expect(body.type).toBe('daywork');
    expect(body.role_name).toBe('Deckhand');
    expect(body.vessel_name).toBe('M/Y Test');
    expect(body.day_rate).toBe(250);
    expect(body.required_certs).toEqual(['STCW']);
    // No employer identity exposed
    expect(body.poster_person_id).toBeUndefined();
    expect(body.poster_name).toBeUndefined();
    expect(body.positions_filled).toBeUndefined();
  });

  it('returns NDA Vessel name for NDA-flagged vessel', async () => {
    mockServiceFrom.mockReturnValueOnce(
      mockChain({
        id: 'd1',
        job_number: 2,
        status: 'active',
        start_date: '2099-01-01',
        end_date: '2099-01-03',
        working_days: 3,
        day_rate: 300,
        currency: 'EUR',
        meals: [],
        notes: null,
        positions_available: 1,
        permanent_opportunity: false,
        required_languages: [],
        vessel_id: 'v2',
        role_id: 'r1',
        location_port_id: 'p1',
        required_certification_ids: [],
        experience_bracket_id: null,
        created_at: '2099-01-01T00:00:00Z',
      }),
    );
    // Hydration: role, port, vessel (no bracket — null id, no certs — empty array)
    mockServiceFrom.mockReturnValueOnce(mockChain({ name: 'Deckhand', department: 'deck' }));
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'Antibes' } } }),
    );
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'M/Y Secret', vessel_type: 'motor', loa_meters: 50, nda_flag: true, vessel_size_bands: { label: '40-60m' } }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('DW-00002'));
    const body = await res.json();
    expect(body.vessel_name).toBe('NDA Vessel');
    expect(body.loa_meters).toBeNull();
  });

  it('returns 200 for permanent posting', async () => {
    mockServiceFrom.mockReturnValueOnce(
      mockChain({
        id: 'pp1',
        job_number: 1,
        status: 'active',
        start_date: '2099-06-01',
        salary_min: 3000,
        salary_max: 4000,
        salary_currency: 'EUR',
        salary_period: 'monthly',
        contract_type: 'Seasonal',
        live_aboard: true,
        shortlist_cap: 5,
        notes: null,
        description: 'Great opportunity',
        required_languages: ['English', 'French'],
        positions_available: 1,
        vessel_id: 'v1',
        role_id: 'r1',
        port_id: 'p1',
        required_certification_ids: [],
        experience_bracket_id: null,
        created_at: '2099-01-01T00:00:00Z',
      }),
    );
    // Hydration: role, port, vessel (no bracket — null id, no certs — empty array)
    mockServiceFrom.mockReturnValueOnce(mockChain({ name: 'Chief Stew', department: 'interior' }));
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'Marina', cities: { name: 'Palma', regions: { name: 'Palma' } } }),
    );
    mockServiceFrom.mockReturnValueOnce(
      mockChain({ name: 'M/Y Atlas', vessel_type: 'motor', loa_meters: 55, nda_flag: false, vessel_size_bands: { label: '40-60m' } }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('PM-00001'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('permanent');
    expect(body.salary_min).toBe(3000);
    expect(body.live_aboard).toBe(true);
    expect(body.contract_type).toBe('Seasonal');
  });
});
