import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/users/route';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockListUsers = vi.fn();
const mockFrom = vi.fn();

function adminOk() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: 'admin-1' },
      supabase: {},
      serviceClient: {
        from: mockFrom,
        auth: { admin: { listUsers: mockListUsers } },
      },
    },
  };
}

function req(qs = '') {
  return new Request(`http://localhost/api/admin/users${qs}`);
}

// Single page of auth users (< 1000 → internal fetch-all loop breaks after 1 call).
function authPage(users: unknown[]) {
  return { data: { users }, error: null };
}

// profiles.select(...).in(...) chain
function profilesReturning(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }),
  };
}

const COMPLETED_PROFILE = {
  person_id: 'u-complete',
  display_name: 'Jane Deckhand',
  identity_type: 'crew',
  location_port_id: 'port-antibes',
  created_at: '2026-05-01T00:00:00Z',
  persons: {
    current_hat: 'crew',
    is_admin: false,
    blocked_at: null,
    deactivated_at: null,
    last_event_at: '2026-05-10T00:00:00Z',
  },
};

describe('GET /api/admin/users (auth-anchored)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('lists both completed and incomplete (pre-onboarding) signups', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockListUsers.mockResolvedValue(
      authPage([
        {
          id: 'u-complete',
          email: 'jane@example.com',
          created_at: '2026-05-01T00:00:00Z',
          email_confirmed_at: '2026-05-01T00:05:00Z',
          banned_until: null,
        },
        {
          id: 'u-incomplete',
          email: 'bob@gmail.com',
          created_at: '2026-05-15T00:00:00Z',
          email_confirmed_at: '2026-05-15T00:01:00Z',
          banned_until: null,
        },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([COMPLETED_PROFILE]));

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.total).toBe(2);
    const byId = Object.fromEntries(
      body.users.map((u: { person_id: string }) => [u.person_id, u]),
    );

    expect(byId['u-complete'].onboarding_complete).toBe(true);
    expect(byId['u-complete'].display_name).toBe('Jane Deckhand');
    expect(byId['u-complete'].persons.current_hat).toBe('crew');

    expect(byId['u-incomplete'].onboarding_complete).toBe(false);
    expect(byId['u-incomplete'].display_name).toBeNull();
    expect(byId['u-incomplete'].identity_type).toBeNull();
    expect(byId['u-incomplete'].persons).toBeNull();
    expect(byId['u-incomplete'].email).toBe('bob@gmail.com');
  });

  it('sorts newest signup first', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockListUsers.mockResolvedValue(
      authPage([
        { id: 'old', email: 'old@x.com', created_at: '2026-01-01T00:00:00Z' },
        { id: 'new', email: 'new@x.com', created_at: '2026-05-15T00:00:00Z' },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([]));

    const res = await GET(req());
    const body = await res.json();
    expect(body.users[0].person_id).toBe('new');
    expect(body.users[1].person_id).toBe('old');
  });

  it('search matches across display_name AND email', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockListUsers.mockResolvedValue(
      authPage([
        { id: 'u-complete', email: 'jane@example.com', created_at: '2026-05-01T00:00:00Z' },
        { id: 'u-incomplete', email: 'bob@gmail.com', created_at: '2026-05-15T00:00:00Z' },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([COMPLETED_PROFILE]));

    // by email (incomplete user has no display_name — must match on email)
    const byEmail = await GET(req('?search=bob'));
    const e = await byEmail.json();
    expect(e.total).toBe(1);
    expect(e.users[0].person_id).toBe('u-incomplete');

    // by display_name (completed user)
    mockListUsers.mockResolvedValue(
      authPage([
        { id: 'u-complete', email: 'jane@example.com', created_at: '2026-05-01T00:00:00Z' },
        { id: 'u-incomplete', email: 'bob@gmail.com', created_at: '2026-05-15T00:00:00Z' },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([COMPLETED_PROFILE]));
    const byName = await GET(req('?search=deckhand'));
    const n = await byName.json();
    expect(n.total).toBe(1);
    expect(n.users[0].person_id).toBe('u-complete');
  });

  it('port filter excludes incomplete signups (they have no port)', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockListUsers.mockResolvedValue(
      authPage([
        { id: 'u-complete', email: 'jane@example.com', created_at: '2026-05-01T00:00:00Z' },
        { id: 'u-incomplete', email: 'bob@gmail.com', created_at: '2026-05-15T00:00:00Z' },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([COMPLETED_PROFILE]));

    const res = await GET(req('?port_id=port-antibes'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.users[0].person_id).toBe('u-complete');
  });

  it('paginates with an accurate total across mixed users', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `u-${i}`,
      email: `u${i}@x.com`,
      created_at: new Date(2026, 4, 25 - i).toISOString(),
    }));
    mockListUsers.mockResolvedValue(authPage(many));
    mockFrom.mockReturnValue(profilesReturning([]));

    const p1 = await GET(req('?page=1'));
    const b1 = await p1.json();
    expect(b1.total).toBe(25);
    expect(b1.users.length).toBe(20);

    mockListUsers.mockResolvedValue(authPage(many));
    mockFrom.mockReturnValue(profilesReturning([]));
    const p2 = await GET(req('?page=2'));
    const b2 = await p2.json();
    expect(b2.total).toBe(25);
    expect(b2.users.length).toBe(5);
  });

  it('flags auth-banned and unverified users', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    const future = new Date(Date.now() + 86_400_000).toISOString();
    mockListUsers.mockResolvedValue(
      authPage([
        {
          id: 'u-banned',
          email: 'banned@x.com',
          created_at: '2026-05-01T00:00:00Z',
          email_confirmed_at: null,
          banned_until: future,
        },
      ]),
    );
    mockFrom.mockReturnValue(profilesReturning([]));

    const res = await GET(req());
    const body = await res.json();
    expect(body.users[0].auth_banned).toBe(true);
    expect(body.users[0].email_confirmed).toBe(false);
  });

  it('returns 500 when the auth API errors', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockListUsers.mockResolvedValue({ data: null, error: { message: 'Auth down' } });

    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Auth down');
  });
});
