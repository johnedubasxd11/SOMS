import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import type { Database } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];

/** The signed-in auth user (validated against Supabase), or null. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The profile row of the signed-in user (RLS: your own row). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data ?? null;
});

/** Redirects to /login when there is no valid session. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?error=inactive');
  return profile;
}

/**
 * Role gate for a route segment. Always reads the role from the database -
 * the proxy only checks that *some* session cookie exists.
 */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect('/dashboard?denied=1');
  }
  return profile;
}

/** Convenience gates used by server actions. */
export async function requireOsa(): Promise<Profile> {
  return requireRole('osa_admin', 'super_admin');
}

export async function requireSuperAdmin(): Promise<Profile> {
  return requireRole('super_admin');
}
