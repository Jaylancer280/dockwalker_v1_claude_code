import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/hat/route';

// Mock Supabase
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  })),
  createServiceClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/hat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/hat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: from().select().eq().single()
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });

  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ hat: 'crew' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid hat value', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
    });

    const res = await POST(makeRequest({ hat: 'admiral' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid hat');
  });

  it('returns 403 when agent tries to switch hats', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 'u1', identity_type: 'agent', current_hat: 'agent' },
    });

    const res = await POST(makeRequest({ hat: 'crew' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Agents cannot switch hats');
  });

  it('returns 200 no-op when already wearing the requested hat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 'u1', identity_type: 'crew', current_hat: 'employer' },
    });

    const res = await POST(makeRequest({ hat: 'employer' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hat).toBe('employer');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns 200 and switches hat for crew identity', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
    });
    mockRpc.mockResolvedValue({ error: null });

    const res = await POST(makeRequest({ hat: 'employer' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hat).toBe('employer');
    expect(mockRpc).toHaveBeenCalledWith(
      'append_event',
      expect.objectContaining({
        p_event_type: 'PERSON.HAT_CHANGED',
        p_payload: { current_hat: 'employer' },
      }),
    );
  });
});
