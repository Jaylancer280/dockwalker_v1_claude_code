import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/auth/me/route';

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with userId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('u1');
  });
});
