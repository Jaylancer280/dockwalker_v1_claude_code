import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '@/app/api/notifications/whatsapp/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockServiceFrom = vi.fn();

function guardOk() {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function chainable(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.delete = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

describe('DELETE /api/notifications/whatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDomainUser.mockResolvedValue(guardOk());
  });

  it('returns 401 for unauthenticated user', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('deletes channel and disables whatsapp in preferences', async () => {
    const deleteBuilder = chainable();
    const updateBuilder = chainable();

    let callIdx = 0;
    mockServiceFrom.mockImplementation(() => {
      callIdx++;
      return callIdx === 1 ? deleteBuilder : updateBuilder;
    });

    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify delete was called on notification_channels
    expect(mockServiceFrom).toHaveBeenCalledWith('notification_channels');
    // Verify update was called on user_preferences
    expect(mockServiceFrom).toHaveBeenCalledWith('user_preferences');
  });
});
