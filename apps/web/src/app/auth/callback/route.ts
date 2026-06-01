import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeRedirectPath } from '@/lib/auth/safe-redirect-path';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Validate `next` against the same-origin allowlist before it is used as a
  // redirect target. An unvalidated value (e.g. `?next=@evil.com`) becomes the
  // URL authority in `${origin}${next}` and lands the freshly-authenticated
  // user on an attacker host (audit 2026-06-01 S4 — open redirect).
  const next = safeRedirectPath(searchParams.get('next')) ?? '/onboarding';
  // Lightweight referee signup (?referee=1) — after email confirmation,
  // run onboard_person with referee_only=true so the user has a minimal
  // profile when they land on /ref/[token]. The full onboarding flow is
  // skipped because referee_only users only need name + email + the
  // ability to consent to references.
  const isReferee = searchParams.get('referee') === '1';

  const cookieStore = await cookies();

  // Collect cookies during auth operations so we can explicitly attach
  // them to the redirect response. cookies().set() alone can be lost
  // when NextResponse.redirect() creates a separate response object.
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // May throw in certain contexts — collected in pendingCookies as fallback
            }
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  function redirectWithCookies(path: string) {
    const response = NextResponse.redirect(`${origin}${path}`);
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  async function maybeOnboardReferee(): Promise<void> {
    if (!isReferee) return;
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      // Skip if already onboarded (defence — onboard_person inserts and
      // would fail on duplicate person_id).
      const { data: existingPerson } = await supabase
        .from('persons')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();
      if (existingPerson) return;
      const displayName = data.user.email?.split('@')[0] ?? 'Referee';
      await supabase.rpc('onboard_person', {
        p_identity_type: 'crew',
        p_current_hat: 'crew',
        p_profile: { display_name: displayName, referee_only: true },
        p_person_id: data.user.id,
      });
    } catch {
      // Onboarding RPC failure shouldn't block the redirect — the
      // /ref/[token] page handles the not-onboarded edge case.
    }
  }

  // PKCE flow: Supabase redirects with a `code` parameter
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await maybeOnboardReferee();
      return redirectWithCookies(next);
    }
  }

  // Fallback: token hash flow (email opened on different browser/device where
  // the PKCE code_verifier cookie is missing, or non-PKCE Supabase config)
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      await maybeOnboardReferee();
      return redirectWithCookies(next);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
