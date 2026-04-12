import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Accept native form POST (application/x-www-form-urlencoded)
  const formData = await request.formData();
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return NextResponse.redirect(
      `${origin}/auth/login?login_error=${encodeURIComponent('Email and password are required')}`,
    );
  }

  const cookieStore = await cookies();
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
              // Collected in pendingCookies as fallback
            }
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase().includes('banned')
      ? 'This account has been deactivated. Contact support if you believe this is an error.'
      : error.message;
    return NextResponse.redirect(`${origin}/auth/login?login_error=${encodeURIComponent(msg)}`);
  }

  // Redirect with session cookies attached — browser follows the redirect
  // and the cookies are set in the same HTTP response. No JavaScript
  // cookie handling, no fetch, no window.location.
  const response = NextResponse.redirect(`${origin}/onboarding`);
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
