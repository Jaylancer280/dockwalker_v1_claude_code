import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/daywork/invitations/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFromAuth, rpc: mockRpc },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

describe('GET /api/daywork/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending invitations for authenticated crew', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // invitations query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'inv-1',
                  daywork_id: 'dw-1',
                  employer_person_id: 'emp-1',
                  status: 'pending',
                  created_at: '2026-03-10',
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    // dayworks query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'dw-1',
              job_number: 1,
              start_date: '2026-04-01',
              end_date: '2026-04-05',
              working_days: 5,
              day_rate: 300,
              currency: 'EUR',
              meals: ['lunch'],
              notes: null,
              status: 'active',
              vessel_id: 'v-1',
              yacht_roles: { id: 'r1', name: 'Deckhand' },
              ports: { id: 'p1', name: 'Port Vauban', cities: { name: 'Antibes', regions: { name: 'Côte d\'Azur' } } },
              experience_brackets: { label: '2-5 years' },
            },
          ],
        }),
      }),
    });
    // employers query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ person_id: 'emp-1', display_name: 'Captain Smith' }],
        }),
      }),
    });
    // vessel RPC
    mockRpc.mockResolvedValueOnce({
      data: { id: 'v-1', name: 'M/Y Serenity', vessel_type: 'motor', size_band_label: '30-50m', nda_flag: false },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitations).toHaveLength(1);
    expect(body.invitations[0].employer_name).toBe('Captain Smith');
    expect(body.invitations[0].daywork.role_name).toBe('Deckhand');
    expect(body.invitations[0].daywork.vessel_name).toBe('M/Y Serenity');
  });

  it('returns empty for non-crew hat', async () => {
    mockRequireDomainUser.mockResolvedValue(
      guardOk({ person: { id: 'u1', identity_type: 'crew', current_hat: 'employer' } }),
    );

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('filters out invitations for fully-filled daywork positions', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // invitations query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'inv-1', daywork_id: 'dw-1', employer_person_id: 'emp-1', status: 'pending', created_at: '2026-03-10' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    // dayworks query — positions full
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'dw-1', job_number: 1, start_date: '2027-06-01', end_date: '2027-06-05',
              working_days: 5, day_rate: 300, currency: 'EUR', meals: [], notes: null,
              status: 'active', vessel_id: null,
              positions_available: 2, positions_filled: 2,
              yacht_roles: null, ports: null, experience_brackets: null,
            },
          ],
        }),
      }),
    });
    // employers query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitations).toHaveLength(0);
  });

  it('keeps invitations for partially-filled daywork positions', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    // invitations query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'inv-1', daywork_id: 'dw-1', employer_person_id: 'emp-1', status: 'pending', created_at: '2026-03-10' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    // dayworks query — partially filled
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'dw-1', job_number: 1, start_date: '2027-06-01', end_date: '2027-06-05',
              working_days: 5, day_rate: 300, currency: 'EUR', meals: [], notes: null,
              status: 'active', vessel_id: null,
              positions_available: 2, positions_filled: 1,
              yacht_roles: null, ports: null, experience_brackets: null,
            },
          ],
        }),
      }),
    });
    // employers query
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [] }) }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitations).toHaveLength(1);
  });

  it('returns empty array when no pending invitations', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitations).toHaveLength(0);
  });
});
