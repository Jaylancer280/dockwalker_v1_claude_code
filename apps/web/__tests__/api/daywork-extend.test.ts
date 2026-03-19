import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/daywork/[id]/extend/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeSingleChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/daywork/d1/extend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/daywork/:id/extend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ endDate: futureDate(10) }), makeParams('d1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: true,
      value: {
        ...guardOk().value,
        person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      },
    });

    const res = await POST(makeRequest({ endDate: futureDate(10) }), makeParams('d1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when daywork is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'completed', start_date: futureDate(1), end_date: futureDate(5) }),
    );

    const res = await POST(makeRequest({ endDate: futureDate(10) }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('active');
  });

  it('returns 400 when endDate is in the past', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'active', start_date: '2024-01-01', end_date: '2024-01-10' }),
    );

    const res = await POST(makeRequest({ endDate: '2020-01-01' }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('past');
  });

  it('returns 400 when extending backwards (new end < current end)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'active', start_date: futureDate(1), end_date: futureDate(10) }),
    );

    const res = await POST(makeRequest({ endDate: futureDate(5) }), makeParams('d1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('current end date');
  });

  it('returns 400 when workingDayDates are outside range', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'active', start_date: futureDate(1), end_date: futureDate(5) }),
    );

    const res = await POST(
      makeRequest({ endDate: futureDate(10), workingDayDates: ['2020-01-01'] }),
      makeParams('d1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('date range');
  });

  it('returns 400 when workingDayDates have duplicates', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const startDate = futureDate(1);
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'active', start_date: startDate, end_date: futureDate(5) }),
    );

    const res = await POST(
      makeRequest({ endDate: futureDate(10), workingDayDates: [startDate, startDate] }),
      makeParams('d1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('duplicates');
  });

  it('returns 200 on successful extension', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeSingleChain({ id: 'd1', status: 'active', start_date: futureDate(1), end_date: futureDate(5) }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const newEnd = futureDate(15);
    const res = await POST(makeRequest({ endDate: newEnd }), makeParams('d1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'DAYWORK.EXTENDED',
        p_payload: expect.objectContaining({
          daywork_id: 'd1',
          end_date: newEnd,
        }),
      }),
    );
  });
});
