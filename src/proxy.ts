import { NextResponse, type NextRequest } from 'next/server';

import { PUBLIC_PATHS } from '@/lib/navigation';

/**
 * Route protection (Next 16: `proxy` replaces `middleware`).
 *
 *   - lets public paths through (/login, /auth callback)
 *   - sends every other request without a session to /login?next=...
 *   - does NOT refresh tokens on every request — token refresh happens
 *     at the page level via getUser() or the browser client, so the proxy
 *     remains fast and never makes a network request for session checks.
 *
 * What it deliberately does NOT do: decide permissions from a cookie. The role
 * lives in Postgres and is enforced per page/action by requireRole() in
 * src/lib/auth.ts, so a tampered cookie can never grant access.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-'));

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isPublic) {
    return NextResponse.next({ request });
  }

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  // Run on every route except Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
