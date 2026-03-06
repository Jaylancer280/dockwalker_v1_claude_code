import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/messages/[engagementId]/route';

const mockGetUser = vi.fn();
const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFromAuth,
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
        order: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

const makeParams = (engagementId: string) => ({
  params: Promise.resolve({ engagementId }),
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/messages/e1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/messages/:engagementId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'c1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with messages filtering hidden', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth
      .mockReturnValueOnce(
        makeChain({
          id: 'e1',
          crew_person_id: 'u1',
          employer_person_id: 'emp1',
          status: 'active',
        }),
      )
      .mockReturnValueOnce(
        makeChain([
          {
            id: 'm1',
            sender_person_id: 'u1',
            content: 'Hello',
            created_at: '2026-04-01',
            hidden_by: null,
          },
          {
            id: 'm2',
            sender_person_id: 'emp1',
            content: 'Hidden',
            created_at: '2026-04-01',
            hidden_by: ['u1'],
          },
        ]),
      );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe('Hello');
  });
});

describe('POST /api/messages/:engagementId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'c1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement not active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        status: 'completed',
      }),
    );

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );

    const res = await POST(makeRequest({ content: '' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful send', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ content: 'Hello employer!' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'MESSAGE.SENT',
        p_role_context: 'crew',
      }),
    );
  });
});
