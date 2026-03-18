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

  // API routes handle their own auth and onboarding errors.
  if (path.startsWith('/api/')) {
    return supabaseResponse;
  }

  // Routes that redirect authenticated users to the app
  const authEntryRoutes = ['/auth/login', '/auth/signup'];
  // All public routes (no auth required)
  const publicRoutes = [
    ...authEntryRoutes,
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));
  const isAuthEntryRoute = authEntryRoutes.some((route) => path.startsWith(route));
  const isLandingPage = path === '/';

  // Not authenticated → redirect to login (unless on public route or landing page)
  if (!user && !isPublicRoute && !isLandingPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Authenticated on login/signup → redirect to app (but NOT on reset-password or forgot-password)
  if (user && isAuthEntryRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  // Authenticated: check onboarding status
  if (user && !isPublicRoute && !path.startsWith('/onboarding')) {
    const [{ data: person }, { data: profile }] = await Promise.all([
      supabase.from('persons').select('id, current_hat').eq('id', user.id).single(),
      supabase.from('profiles').select('person_id').eq('person_id', user.id).single(),
    ]);

    if (!person || !profile) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Hat-routed landing: redirect /dashboard (and /) to the primary action surface
    if (path === '/dashboard' || path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = person.current_hat === 'crew' ? '/discover' : '/daywork/mine';
      return NextResponse.redirect(url);
    }
  }

  // On onboarding page but already onboarded → redirect by hat
  if (user && path.startsWith('/onboarding')) {
    const { data: person } = await supabase
      .from('persons')
      .select('id, current_hat')
      .eq('id', user.id)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('person_id')
      .eq('person_id', user.id)
      .single();

    if (person && profile) {
      const url = request.nextUrl.clone();
      url.pathname = person.current_hat === 'crew' ? '/discover' : '/daywork/mine';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
