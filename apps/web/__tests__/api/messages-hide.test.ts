import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/messages/[engagementId]/hide/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockFromService = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    from: mockFromService,
    rpc: mockRpc,
  })),
}));

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
      }),
    }),
  };
}

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/messages/e1/hide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/messages/:engagementId/hide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'c1',
        employer_person_id: 'emp1',
      }),
    );

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when messageId not provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );

    const res = await POST(makeRequest({}), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when message not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );
    mockFromService.mockReturnValueOnce(makeChain(null));

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 no-op when already hidden', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );
    mockFromService.mockReturnValueOnce(
      makeChain({ id: 'm1', hidden_by: ['u1'] }),
    );

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
  });

  it('returns 200 and updates hidden_by', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
      }),
    );
    mockFromService
      .mockReturnValueOnce(makeChain({ id: 'm1', hidden_by: [] }));
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ messageId: 'm1' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'MESSAGE.HIDDEN',
        p_aggregate_id: 'm1',
      }),
    );
  });
});
