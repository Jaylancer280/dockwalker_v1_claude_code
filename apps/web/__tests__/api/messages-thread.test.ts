import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/messages/[engagementId]/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

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

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
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
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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

  it('returns 200 with all messages', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
          },
          {
            id: 'm2',
            sender_person_id: 'emp1',
            content: 'Hi back',
            created_at: '2026-04-01',
          },
        ]),
      );

    const res = await GET(new Request('http://localhost'), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
  });
});

describe('POST /api/messages/:engagementId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));

    const res = await POST(makeRequest({ content: 'Hi' }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user not part of engagement', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
    mockRequireDomainUser.mockResolvedValue(guardOk());
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

  it('returns 400 when message exceeds 2000 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );

    const longContent = 'a'.repeat(2001);
    const res = await POST(makeRequest({ content: longContent }), makeParams('e1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('2000');
  });

  it('allows message of exactly 2000 characters', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(
      makeChain({
        id: 'e1',
        crew_person_id: 'u1',
        employer_person_id: 'emp1',
        status: 'active',
      }),
    );
    mockRpc.mockResolvedValueOnce({ error: null });

    const exactContent = 'a'.repeat(2000);
    const res = await POST(makeRequest({ content: exactContent }), makeParams('e1'));
    expect(res.status).toBe(200);
  });

  it('returns 200 on successful send', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
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
        p_payload: expect.objectContaining({
          id: expect.any(String),
          content: 'Hello employer!',
        }),
      }),
    );
  });
});
