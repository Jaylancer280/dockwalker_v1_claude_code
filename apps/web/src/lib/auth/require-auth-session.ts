import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthSession {
  user: { id: string };
  supabase: SupabaseClient;
}

type AuthSessionResult = { ok: true; value: AuthSession } | { ok: false; response: NextResponse };

/**
 * Lightweight auth guard — verifies a Supabase session exists and returns
 * a user-bound client. Does NOT require `persons` row, `profiles` row, or
 * onboarding completion. Use on canonical-lookup endpoints that brand-new
 * users need access to during onboarding (e.g. location search).
 *
 * Mirrors `requireDomainUser`'s middleware fast-path (skips a duplicate
 * `getUser()` call when the proxy has already validated the session) but
 * skips every domain-state gate.
 */
export async function requireAuthSession(): Promise<AuthSessionResult> {
  const reqHeaders = await headers();
  const headerUserId = reqHeaders.get('x-user-id');
  const supabase = await createClient();

  if (headerUserId) {
    return {
      ok: true,
      value: { user: { id: headerUserId }, supabase },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return {
    ok: true,
    value: { user: { id: user.id }, supabase },
  };
}
