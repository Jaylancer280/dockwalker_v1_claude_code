import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/users?search=<name|email>&port_id=<id>&page=<n>
 *
 * Admin-only user listing. Anchored on `auth.users` (via the Supabase
 * Auth admin API) rather than `profiles`, so signups that never finished
 * onboarding — they have an `auth.users` row but no `persons`/`profiles`
 * row yet — are still visible. Google OAuth signups are the common case
 * here: one-click signup with no email-verification gate means a higher
 * share of them bail before completing the multi-step onboarding form.
 *
 * The previous implementation queried `profiles` with `persons!inner`,
 * which silently hid every pre-onboarding signup from ops.
 *
 * Strategy: fetch all auth users (paginated internally), enrich each
 * with profile + persons data via chunked `IN (...)` lookups, then
 * filter / sort / paginate in JS. Acceptable for the current user base;
 * revisit with a server-side join (e.g. a materialised view of
 * auth.users → profiles) past ~5k users — see ADMIN-1 in tasks/todo.md.
 */

const AUTH_PAGE_SIZE = 1000; // Supabase admin listUsers max per page
const MAX_USERS = 10000; // safety cap on the in-memory fetch-all
const ENRICH_CHUNK = 500; // bound the IN (...) clause size
const PER_PAGE = 20;

interface EnrichedProfile {
  person_id: string;
  display_name: string;
  identity_type: string;
  location_port_id: string | null;
  created_at: string;
  persons: {
    current_hat: string;
    is_admin: boolean;
    blocked_at: string | null;
    deactivated_at: string | null;
    last_event_at: string | null;
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();
  const portId = searchParams.get('port_id');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PER_PAGE;

  try {
    // 1. Fetch all auth users (paginated internally, hard-capped).
    type AuthUser = {
      id: string;
      email?: string | null;
      created_at?: string;
      email_confirmed_at?: string | null;
      banned_until?: string | null;
    };
    const authUsers: AuthUser[] = [];
    let authPage = 1;
    while (authUsers.length < MAX_USERS) {
      const { data, error } = await serviceClient.auth.admin.listUsers({
        page: authPage,
        perPage: AUTH_PAGE_SIZE,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const batch = (data?.users ?? []) as AuthUser[];
      authUsers.push(...batch);
      if (batch.length < AUTH_PAGE_SIZE) break; // last page
      authPage++;
    }

    // 2. Enrich with profile + persons data (chunked IN lookups).
    //    `persons!inner` is safe here — we only match rows that have a
    //    completed onboarding (both rows exist). Auth users absent from
    //    this map are pre-onboarding signups.
    const profileMap = new Map<string, EnrichedProfile>();
    const ids = authUsers.map((u) => u.id);
    for (const idChunk of chunk(ids, ENRICH_CHUNK)) {
      const { data, error } = await serviceClient
        .from('profiles')
        .select(
          'person_id, display_name, identity_type, location_port_id, created_at, persons!inner(current_hat, is_admin, blocked_at, deactivated_at, last_event_at)',
        )
        .in('person_id', idChunk);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      for (const row of (data ?? []) as unknown as EnrichedProfile[]) {
        profileMap.set(row.person_id, row);
      }
    }

    // 3. Merge into a uniform shape. created_at is the auth signup time
    //    (defined for everyone) so ordering is consistent across
    //    completed + incomplete users; the profile created_at is
    //    surfaced separately when present.
    const now = Date.now();
    const merged = authUsers.map((au) => {
      const p = profileMap.get(au.id) ?? null;
      const bannedUntil = au.banned_until ? new Date(au.banned_until).getTime() : 0;
      return {
        person_id: au.id,
        email: au.email ?? null,
        display_name: p?.display_name ?? null,
        identity_type: p?.identity_type ?? null,
        location_port_id: p?.location_port_id ?? null,
        created_at: au.created_at ?? p?.created_at ?? null,
        onboarding_complete: !!p,
        email_confirmed: !!au.email_confirmed_at,
        auth_banned: bannedUntil > now,
        persons: p?.persons ?? null,
      };
    });

    // 4. Filter — search across display_name + email; port filter only
    //    matches completed users (incomplete signups have no port).
    let filtered = merged;
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.display_name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search),
      );
    }
    if (portId) {
      filtered = filtered.filter((u) => u.location_port_id === portId);
    }

    // 5. Sort newest-signup-first, then paginate in JS.
    filtered.sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });

    const total = filtered.length;
    const users = filtered.slice(offset, offset + PER_PAGE);

    return NextResponse.json({ users, total, page, perPage: PER_PAGE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
