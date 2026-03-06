import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ['/auth/login', '/auth/signup', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Not authenticated → redirect to login (unless on public route)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Authenticated on public route → redirect to app
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  // Authenticated: check onboarding status
  if (user && !isPublicRoute && !path.startsWith('/onboarding')) {
    const { data: person } = await supabase.from('persons').select('id').eq('id', user.id).single();

    if (!person) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  // On onboarding page but already onboarded → redirect to dashboard
  if (user && path.startsWith('/onboarding')) {
    const { data: person } = await supabase.from('persons').select('id').eq('id', user.id).single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('person_id')
      .eq('person_id', user.id)
      .single();

    if (person && profile) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
