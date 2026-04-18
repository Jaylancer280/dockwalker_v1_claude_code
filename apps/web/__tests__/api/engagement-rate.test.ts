import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/engagements/[id]/rate/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  const inner = {
    not: vi.fn(),
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data }),
    }),
    single: vi.fn().mockResolvedValue({ data }),
  };
  inner.not.mockReturnValue(inner);
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(inner),
    }),
  };
}

function guardOk(userId = 'crew1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const crewRatingBody = {
  pay_accuracy: 'yes',
  meals_accuracy: 'yes',
  role_accuracy: 'yes',
  working_days_accuracy: 'as_listed',
  vessel_condition: 4,
  would_work_on_vessel_again: true,
  communication_accuracy: true,
  overall_match: 5,
};

const employerRatingBody = {
  skills_as_advertised: 'yes',
  certifications_verified: 'yes',
  punctuality: 'yes',
  would_rehire: true,
  communication_accuracy: true,
  overall_match: 4,
};

describe('POST /api/engagements/:id/rate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not part of the engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('outsider'));
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
        status: 'completed', crew_completion_status: 'confirmed',
      }),
    );

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not completed', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
        status: 'active', crew_completion_status: null,
      }),
    );

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when crew has not confirmed/disputed completion yet', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
        status: 'completed', crew_completion_status: null,
      }),
    );

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('confirm or dispute');
  });

  it('returns 409 when already rated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain({ id: 'rating1' }));

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid crew rating fields', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(
      makeRequest({ ...crewRatingBody, pay_accuracy: 'invalid' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid employer rating fields', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null));

    const res = await POST(
      makeRequest({ ...employerRatingBody, skills_as_advertised: 'bad' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 and emits RATED_BY_CREW for crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.RATED_BY_CREW' }),
    );
  });

  it('returns 200 and emits RATED_BY_EMPLOYER for employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(employerRatingBody), makeParams('e1'));
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.RATED_BY_EMPLOYER' }),
    );
  });

  it('employer can rate without crew having confirmed (no crew gate for employer)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          status: 'completed', crew_completion_status: null,
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(employerRatingBody), makeParams('e1'));
    expect(res.status).toBe(200);
  });

  it('includes permanent_opportunity_accuracy in RATED_BY_CREW when daywork had flag', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          daywork_id: 'dw1', status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null)) // no existing rating
      .mockReturnValueOnce(makeChain({ permanent_opportunity: true })); // daywork lookup
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ ...crewRatingBody, permanent_opportunity_accuracy: 'yes' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'ENGAGEMENT.RATED_BY_CREW',
        p_payload: expect.objectContaining({
          permanent_opportunity_accuracy: 'yes',
        }),
      }),
    );
  });

  it('crew completed rating still passes without permanent_opportunity_accuracy', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1', crew_person_id: 'crew1', employer_person_id: 'emp1',
          daywork_id: 'dw1', status: 'completed', crew_completion_status: 'confirmed',
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(makeRequest(crewRatingBody), makeParams('e1'));
    expect(res.status).toBe(200);
    // Payload should NOT contain the field
    const payload = mockRpc.mock.calls[0][1].p_payload;
    expect(payload).not.toHaveProperty('permanent_opportunity_accuracy');
  });

  // ---------------------------------------------------------------------------
  // Permanent engagement rating (status='closed' with outcome)
  // ---------------------------------------------------------------------------

  it('crew can rate a permanent engagement closed with outcome=withdrew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'crew1',
          employer_person_id: 'emp1',
          daywork_id: null,
          permanent_posting_id: 'pm1',
          status: 'closed',
          outcome: 'withdrew',
          crew_completion_status: null,
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({
        notice_given: 'yes',
        communication_accuracy: true,
        overall_match: 4,
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.CANCELLATION_RATED_BY_CREW' }),
    );
  });

  it('employer can rate a permanent engagement closed with outcome=not_successful', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'crew1',
          employer_person_id: 'emp1',
          daywork_id: null,
          permanent_posting_id: 'pm1',
          status: 'closed',
          outcome: 'not_successful',
          crew_completion_status: null,
        }),
      )
      .mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({
        communication_accuracy: true,
        overall_match: 3,
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({ p_event_type: 'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER' }),
    );
  });

  it('rejects rating on closed engagement with outcome=successful_placement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'crew1',
        employer_person_id: 'emp1',
        daywork_id: null,
        permanent_posting_id: 'pm1',
        status: 'closed',
        outcome: 'successful_placement',
        crew_completion_status: null,
      }),
    );

    const res = await POST(
      makeRequest({
        notice_given: 'yes',
        communication_accuracy: true,
        overall_match: 5,
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('rejects rating on closed engagement with no outcome', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'crew1',
        employer_person_id: 'emp1',
        daywork_id: null,
        permanent_posting_id: 'pm1',
        status: 'closed',
        outcome: null,
        crew_completion_status: null,
      }),
    );

    const res = await POST(
      makeRequest({
        notice_given: 'yes',
        communication_accuracy: true,
        overall_match: 5,
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });
});
