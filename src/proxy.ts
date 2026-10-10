import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { PUBLIC_PATHS } from '@/lib/navigation';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

/**
 * Route protection + session refresh (Next 16: `proxy` replaces `middleware`).
 *
 *   - refreshes the Supabase session when the access token expired, so a
 *     60-minute-old tab keeps working instead of silently logging the user out
 *   - lets public paths through (/login, /auth callback)
 *   - sends every other request without a session to /login?next=...
 *
 * What it deliberately does NOT do: decide permissions from a cookie. The role
 * lives in Postgres and is enforced per page/action by requireRole() in
 * src/lib/auth.ts, so a tampered cookie can never grant access.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Cookies refreshed while calling getUser() below.
  const refreshed: { name: string; value: string; options?: Parameters<
    NextResponse['cookies']['set']
  >[2] }[] = [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          refreshed.push({ name, value, options })
        );
      },
    },
  });

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-'));

  // Only hit the network when a session cookie exists, otherwise every
  // anonymous request (assets included) would trigger a round trip.
  if (hasSession) {
    try {
      await supabase.auth.getUser(); // refreshes the tokens when needed
    } catch {
      // Network/auth error: fall through - the page layer re-checks.
    }
  }

  const withCookies = (response: NextResponse) => {
    refreshed.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  };

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isPublic) {
    if (pathname.startsWith('/login') && hasSession) {
      return withCookies(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    return withCookies(NextResponse.next({ request }));
  }

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return withCookies(NextResponse.next({ request }));
}

export const config = {
  // Run on every route except Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
