import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { REGISTRATION_ENABLED } from '@/lib/registration';

export async function proxy(request: NextRequest) {
  // ERP integration routes and webhook routes use their own auth — skip session check
  if (
    request.nextUrl.pathname.startsWith('/api/erp/') ||
    request.nextUrl.pathname.startsWith('/api/webhooks/')
  ) {
    return NextResponse.next();
  }

  // Registration is gated by a feature flag. When closed, the sign-up route is
  // not reachable — send visitors to the login page instead.
  if (!REGISTRATION_ENABLED && request.nextUrl.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const publicPaths = ['/login', '/signup', '/lp'];
  if (!user && !publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
