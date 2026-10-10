import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

/**
 * Server-side client bound to the caller's session cookies.
 * Use it in Server Components, Server Actions and route handlers.
 * It carries the logged-in user, so every query is checked against RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component: middleware refreshes the session
          // instead, so ignoring this is safe.
        }
      },
    },
  });
}
