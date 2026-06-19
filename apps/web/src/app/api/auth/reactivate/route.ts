import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { appendEvent } from '@dockwalker/db';
import { getReactivateLimit } from '@/lib/rate-limit';

/**
 * POST /api/auth/reactivate
 *
 * Called by the reset-password page after a successful password update.
 * If the user's persons row has deactivated_at set, this clears it (via
 * PERSON.REACTIVATED event) and lifts the auth ban — restoring the account.
 *
 * Intentionally does NOT use requireDomainUser, which would block deactivated
 * users at the auth guard. Instead, reads the user directly from the session
 * cookies (which were established via the password recovery email link).
 *
 * Returns { reactivated: true } if the account was restored, or
 * { reactivated: false } if no deactivation flag was set (no-op).
 *
 * Rate-limited at 5/hour/IP (audit P1-S5 — defensive depth on top of the
 * auth-session gate; legitimate users only hit this once).
 */
export async function POST() {
  // Per-route rate limit (defensive depth on top of the global+write limits).
  const limiter = getReactivateLimit();
  if (limiter) {
    const headerList = await headers();
    const ip =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      'unknown';
    const { success, remaining, reset } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many reactivation attempts. Try again in an hour.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(remaining),
          },
        },
      );
    }
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op — we don't update cookies in this route
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  const { data: person, error: personError } = await serviceClient
    .from('persons')
    .select('id, current_hat, deactivated_at')
    .eq('id', user.id)
    .single();

  if (personError || !person) {
    // No persons row — nothing to reactivate (e.g., user never completed onboarding)
    return NextResponse.json({ reactivated: false });
  }

  if (person.deactivated_at === null) {
    // Account is already active — no-op
    return NextResponse.json({ reactivated: false });
  }

  try {
    // Append PERSON.REACTIVATED — projection clears deactivated_at via apply_projection
    await appendEvent(serviceClient, {
      eventType: 'PERSON.REACTIVATED',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    // Lift the auth ban (PERSON.DEACTIVATED's twin set ban_duration: '876000h')
    const { error: unbanError } = await serviceClient.auth.admin.updateUserById(user.id, {
      ban_duration: 'none',
    });

    if (unbanError) {
      // Ledger event was written; ban lift failed. Surface the error so the
      // client knows the reactivation is incomplete and the user should
      // contact support.
      return NextResponse.json(
        {
          error:
            'Account flag cleared but session unlock failed. Contact support to complete reactivation.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ reactivated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reactivate account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
