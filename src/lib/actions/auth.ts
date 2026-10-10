'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validations/auth';

export interface LoginState {
  error?: string;
  /** Echoed back so the user lands where they wanted to go. */
  next?: string;
}

/**
 * Sign in with e-mail + password.
 * Rate limited through the check_rate_limit() Postgres function, which works
 * before any session exists and cannot be bypassed from the browser.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { email, password, next } = parsed.data;
  const normalizedNext = next && next.startsWith('/') ? next : '/dashboard';

  const supabase = await createClient();

  // ---- rate limiting ------------------------------------------------------
  const { data: limit, error: limitError } = await supabase.rpc('check_rate_limit', {
    p_key: `login:${email.toLowerCase()}`,
    p_max_attempts: 5,
    p_window_seconds: 900,
    p_block_seconds: 900,
  });

  if (!limitError && limit) {
    const result = limit as { allowed?: boolean; retry_after_seconds?: number };
    if (result.allowed === false) {
      const seconds = Number(result.retry_after_seconds ?? 0);
      return {
        error: `Too many attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
        next,
      };
    }
  }

  // ---- sign in ------------------------------------------------------------
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: 'Invalid e-mail or password.', next };
  }

  // Deactivated accounts must not keep a session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      return { error: 'This account has been deactivated. Contact OSA.', next };
    }
  }

  redirect(normalizedNext);
}

/** Sign out and return to the login screen. */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
