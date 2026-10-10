'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  changePasswordSchema,
  updateProfileSchema,
} from '@/lib/validations/profiles';

/**
 * Self-service edit of full name and position.
 * Runs through the session client: RLS `profiles_update_own` plus
 * `enforce_profile_guard()` still apply - role, organization, college,
 * e-mail and the active flag can never be changed from here.
 */
export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = updateProfileSchema.safeParse({
    full_name: formData.get('full_name'),
    position: formData.get('position') || undefined,
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      position: parsed.data.position?.trim() || null,
    })
    .eq('id', profile.id);

  if (error) return fail(error.message);

  // The (app) layout shows the display name - refresh it everywhere.
  revalidatePath('/profile', 'layout');
  return ok('Profile updated.');
}

/**
 * Change the signed-in user's own password (Supabase Auth session client -
 * only the current session's user can be updated this way, no admin rights
 * involved).
 */
export async function changePasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProfile();

  const parsed = changePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return fail(error.message);

  return ok('Password updated. Use it the next time you sign in.');
}
