import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

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

  // PKCE flow: Supabase redirects with a `code` parameter
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
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
      return redirectWithCookies(next);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
