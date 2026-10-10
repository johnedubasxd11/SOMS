import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/**
 * PRIVILEGED CLIENT - service role key.
 *
 * Bypasses Row Level Security. Only for:
 *   - server actions / route handlers that must act on behalf of the system
 *   - scripts (scripts/seed-users.ts)
 *
 * It must never be imported by a Client Component: the `server-only` import
 * makes `next build` fail if that ever happens.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (server only, no NEXT_PUBLIC_ prefix). See .env.example.'
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
