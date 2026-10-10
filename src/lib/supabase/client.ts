'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

/**
 * Browser-side Supabase client. Session cookies are managed by @supabase/ssr.
 * RLS still applies - this client only ever sees rows the policies allow.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
