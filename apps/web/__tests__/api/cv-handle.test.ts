import { describe, it, expect, vi, beforeEach } from 'vitest';

// Feature flag is hard-locked off; tests here cover the underlying
// behaviour for when Stage 2 unlocks. Locked-state coverage is in
// `cv-handle-locked.test.ts`.
vi.mock('@/lib/cv/feature-flag', () => ({
  CV_BUILDER_ENABLED: true,
  CV_BUILDER_LOCKED_PAYLOAD: { error: 'locked', message: 'locked' },
}));

const mockGetUser = vi.fn();
const mockServiceFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(async () => ({
    from: mockServiceFrom,
  })),
}));

const mockResolveHistorical = vi.fn().mockResolvedValue(new Map());
vi.mock('@/lib/vessels/historical-names', () => ({
  resolveHistoricalVesselNames: (...args: unknown[]) => mockResolveHistorical(...args),
}));

const mockAuthLimit = vi.fn();
const mockAnonLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getCvHandleAuthLimit: () => ({ limit: mockAuthLimit }),
  getCvHandleAnonLimit: () => ({ limit: mockAnonLimit }),
}));

import { GET } from '@/app/api/cv/[handle]/route';

function makeRequest(): Request {
  return new Request('http://localhost/api/cv/AbCd1234', {
    method: 'GET',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });
}

function makeParams(handle: string) {
  return { params: Promise.resolve({ handle }) };
}

/**
 * Returns a thenable chain that resolves the configured `data`/`error`
 * for whichever terminal accessor (`maybeSingle` / `single` / `select`
 * variants / `then`) the route ends up calling. Reused across all the
 * service-client lookups in the route.
 */
function chain(terminal: { data: unknown; error?: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self: any = {};
  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.order = vi.fn().mockReturnValue(self);
  self.maybeSingle = vi.fn().mockResolvedValue({
    data: terminal.data,
    error: terminal.error ?? null,
  });
  self.single = vi.fn().mockResolvedValue({
    data: terminal.data,
    error: terminal.error ?? null,
  });
  self.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: terminal.data, error: terminal.error ?? null }).then(resolve);
  return self;
}

const ACTIVE_PROFILE = {
  person_id: 'p1',
  display_name: 'Sophie Laurent',
  deck_name: null,
  identity_type: 'crew',
  bio: 'Experienced bosun.',
  avatar_url: null,
  cv_handle: 'AbCd1234',
  cv_handle_updated_at: '2026-04-01T00:00:00Z',
  cv_include_sea_time: false,
  cv_generated_at: '2026-04-01T00:00:00Z',
  permanent_availability: 'immediate',
  notice_period_days: null,
  currently_employed: false,
  primary_role_id: 'r1',
  certification_ids: [],
  vessel_size_exposure_ids: [],
  location_port_id: null,
  location_city_id: null,
  nationality_ids: [],
  entry_right_ids: [],
  languages: ['en'],
  smoker: false,
  visible_tattoos: false,
  updated_at: '2026-04-01T00:00:00Z',
  yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
  ports: null,
  location_cities: null,
};

describe('GET /api/cv/[handle]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAuthLimit.mockResolvedValue({ success: true, remaining: 99, reset: Date.now() + 1000 });
    mockAnonLimit.mockResolvedValue({ success: true, remaining: 19, reset: Date.now() + 1000 });
  });

  it('400s when handle is not 8-char alphanumeric', async () => {
    const res = await GET(makeRequest(), makeParams('bad-handle'));
    expect(res.status).toBe(400);
  });

  it('429s when anon rate limit fires', async () => {
    mockAnonLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 1000 });
    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('uses the AUTH limiter when caller is signed in', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u-auth' } } });
    mockServiceFrom
      // profile lookup
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      // person lookup
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      // experiences
      .mockReturnValueOnce(chain({ data: [] }))
      // references
      .mockReturnValueOnce(chain({ data: [] }));

    await GET(makeRequest(), makeParams('AbCd1234'));
    expect(mockAuthLimit).toHaveBeenCalledTimes(1);
    expect(mockAnonLimit).not.toHaveBeenCalled();
    // The key for auth callers is `auth:<userId>`.
    expect(mockAuthLimit).toHaveBeenCalledWith('auth:u-auth');
  });

  it('returns 404 when profile not found', async () => {
    mockServiceFrom.mockReturnValueOnce(chain({ data: null }));
    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    expect(res.status).toBe(404);
  });

  it('returns tombstone payload for deactivated crew', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: {
            id: 'p1',
            current_hat: 'crew',
            deactivated_at: '2026-03-01T00:00:00Z',
            blocked_at: null,
          },
        }),
      );

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ tombstone: true });
  });

  it('returns tombstone for scrubbed crew (current_hat is null after PERSON.DATA_SCRUBBED)', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: null, deactivated_at: null, blocked_at: null },
        }),
      );

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.tombstone).toBe(true);
  });

  it('NDA-masks experience name + IMO when cv_show_full_vessel is false', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 'e1',
              vessel_id: 'v1',
              start_date: '2024-01-01',
              end_date: '2024-12-31',
              is_current: false,
              vessel_operation: 'private',
              flag_state: 'GB',
              contract_type: 'permanent',
              contract_details: null,
              description: null,
              sea_time_days: 100,
              sea_time_nautical_miles: 1000,
              cv_show_full_vessel: false,
              vessels: {
                id: 'v1',
                imo_number: '1234567',
                name: 'M/Y Secret',
                vessel_type: 'motor',
                nda_flag: true,
              },
              yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
            },
          ],
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.experiences).toHaveLength(1);
    const exp = body.experiences[0];
    expect(exp.vessel_name).toBe('NDA Vessel');
    expect(exp.vessel_imo).toBeNull();
    expect(exp.flag_state).toBeNull();
    expect(exp.nda_masked).toBe(true);
  });

  it('does NOT mask non-NDA vessels even when cv_show_full_vessel is false', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 'e1',
              vessel_id: 'v1',
              start_date: '2024-01-01',
              end_date: '2024-12-31',
              is_current: false,
              vessel_operation: 'private',
              flag_state: 'GB',
              contract_type: null,
              contract_details: null,
              description: null,
              sea_time_days: 0,
              sea_time_nautical_miles: 0,
              cv_show_full_vessel: false,
              vessels: {
                id: 'v1',
                imo_number: '1234567',
                name: 'M/Y Public',
                vessel_type: 'motor',
                nda_flag: false,
              },
              yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
            },
          ],
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    const exp = body.experiences[0];
    expect(exp.vessel_name).toBe('M/Y Public');
    expect(exp.vessel_imo).toBe('1234567');
    expect(exp.nda_masked).toBe(false);
  });

  it('only includes references with status=accepted AND include_on_cv=true (route-layer eq filters)', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }));
    const refsChain = chain({ data: [] });
    mockServiceFrom.mockReturnValueOnce(refsChain);

    await GET(makeRequest(), makeParams('AbCd1234'));
    expect(refsChain.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(refsChain.eq).toHaveBeenCalledWith('include_on_cv', true);
  });

  it('omits sea_time when cv_include_sea_time is false (default privacy)', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: ACTIVE_PROFILE }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.sea_time).toBeNull();
  });

  it('sums sea_time totals when cv_include_sea_time is true', async () => {
    mockServiceFrom
      .mockReturnValueOnce(chain({ data: { ...ACTIVE_PROFILE, cv_include_sea_time: true } }))
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 'e1',
              vessel_id: 'v1',
              start_date: '2024-01-01',
              end_date: null,
              is_current: true,
              vessel_operation: 'private',
              flag_state: null,
              contract_type: null,
              contract_details: null,
              description: null,
              sea_time_days: 200,
              sea_time_nautical_miles: 5000,
              cv_show_full_vessel: true,
              vessels: { id: 'v1', imo_number: '1', name: 'A', vessel_type: 'motor', nda_flag: false },
              yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
            },
            {
              id: 'e2',
              vessel_id: 'v2',
              start_date: '2023-01-01',
              end_date: '2023-12-31',
              is_current: false,
              vessel_operation: 'private',
              flag_state: null,
              contract_type: null,
              contract_details: null,
              description: null,
              sea_time_days: 100,
              sea_time_nautical_miles: 2500,
              cv_show_full_vessel: true,
              vessels: { id: 'v2', imo_number: '2', name: 'B', vessel_type: 'motor', nda_flag: false },
              yacht_roles: { id: 'r1', name: 'Bosun', department: 'Deck' },
            },
          ],
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.sea_time).toEqual({ days: 300, nautical_miles: 7500 });
  });

  it('flags stale=true when profile.updated_at > cv_generated_at + 30d', async () => {
    const now = new Date('2026-04-01T00:00:00Z').getTime();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    mockServiceFrom
      .mockReturnValueOnce(
        chain({
          data: {
            ...ACTIVE_PROFILE,
            cv_generated_at: ninetyDaysAgo,
            updated_at: new Date(now).toISOString(),
          },
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.stale).toBe(true);
  });

  it('flags stale=false when updated_at is within the 30-day grace window', async () => {
    const now = new Date('2026-04-01T00:00:00Z').getTime();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockServiceFrom
      .mockReturnValueOnce(
        chain({
          data: {
            ...ACTIVE_PROFILE,
            cv_generated_at: tenDaysAgo,
            updated_at: new Date(now).toISOString(),
          },
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: { id: 'p1', current_hat: 'crew', deactivated_at: null, blocked_at: null },
        }),
      )
      .mockReturnValueOnce(chain({ data: [] }))
      .mockReturnValueOnce(chain({ data: [] }));

    const res = await GET(makeRequest(), makeParams('AbCd1234'));
    const body = await res.json();
    expect(body.stale).toBe(false);
  });
});
