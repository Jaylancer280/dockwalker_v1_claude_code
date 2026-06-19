import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/notifications/whatsapp/status/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockDecryptPhone = vi.fn();
vi.mock('@/lib/crypto', () => ({
  decryptPhone: (...args: unknown[]) => mockDecryptPhone(...args),
}));

const mockFromService = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data }),
        }),
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
      supabase: { from: vi.fn() },
      serviceClient: { from: mockFromService },
    },
  };
}

describe('GET /api/notifications/whatsapp/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns connected: false when no channel exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce(makeChain(null));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.maskedPhone).toBeNull();
  });

  it('returns connected: false when channel is unverified', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce(
      makeChain({ channel_value_encrypted: Buffer.from('enc'), verified: false }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it('returns connected: true with masked phone for verified channel', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromService.mockReturnValueOnce(
      makeChain({ channel_value_encrypted: Buffer.from('enc'), verified: true }),
    );
    mockDecryptPhone.mockReturnValue('+33612345678');

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.maskedPhone).toContain('•');
    expect(body.maskedPhone).not.toContain('612345');
  });
});
