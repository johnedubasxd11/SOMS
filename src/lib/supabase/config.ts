// Shared Supabase connection settings.
// Only NEXT_PUBLIC_* values may be read here - the service role key lives in
// src/lib/supabase/admin.ts and must never reach the browser bundle.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surfaced during `next build` / `next dev` so a missing .env.local is
  // reported once, clearly, instead of as an obscure fetch error later.
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Run `npx supabase status -o env` and copy the values into .env.local ' +
      '(see .env.example).'
  );
}
