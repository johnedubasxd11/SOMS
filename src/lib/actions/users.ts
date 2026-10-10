'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireSuperAdmin } from '@/lib/auth';
import type { UserRole } from '@/lib/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '@/lib/validations/users';

type Role = (typeof createUserSchema.shape.role.options)[number];

function normalizeOrganizationId(
  role: Role,
  organizationId: string | undefined
): string | null {
  if (role === 'adviser' || role === 'officer') return organizationId ?? null;
  // OSA and Super Admin accounts are not tied to a student organization.
  return null;
}

/** Deans belong to a college; every other role does not. */
function normalizeCollegeId(
  role: Role,
  collegeId: string | undefined
): string | null {
  return role === 'dean' ? collegeId ?? null : null;
}

/**
 * Create an Auth user. Only the service-role client can write to
 * auth.users; the profile row is then filled in through the *session*
 * client so RLS and the profile guard still apply.
 */
export async function createUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = createUserSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    organization_id: formData.get('organization_id') || undefined,
    college_id: formData.get('college_id') || undefined,
    position: formData.get('position') || undefined,
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return fail('That e-mail address is already registered.');
    }
    return fail(error.message);
  }

  const userId = created.user?.id;
  if (!userId) return fail('The account was created but could not be read back.');

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: input.full_name,
      role: input.role,
      organization_id: normalizeOrganizationId(input.role, input.organization_id),
      college_id: normalizeCollegeId(input.role, input.college_id),
      position: input.position?.trim() || null,
      is_active: true,
    })
    .eq('id', userId);

  if (profileError) {
    return fail(
      `The account was created but the profile could not be configured: ${profileError.message}`
    );
  }

  revalidatePath('/admin/users');
  return ok(`Created the account for ${input.full_name}.`);
}

/**
 * Change name / role / organization / position / active flag.
 * Runs through the session client: RLS (profiles_update_osa) and the
 * enforce_profile_guard() trigger both apply.
 */
export async function updateUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();

  const parsed = updateUserSchema.safeParse({
    id: formData.get('id'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    organization_id: formData.get('organization_id') || undefined,
    college_id: formData.get('college_id') || undefined,
    position: formData.get('position') || undefined,
    is_active: formData.get('is_active') === 'on',
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const input = parsed.data;

  if (input.id === actor.id) {
    if (!input.is_active) return fail('You cannot deactivate your own account.');
    if (input.role !== 'super_admin') return fail('You cannot change your own role.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.full_name,
      role: input.role as UserRole,
      organization_id: normalizeOrganizationId(input.role, input.organization_id),
      college_id: normalizeCollegeId(input.role, input.college_id),
      position: input.position?.trim() || null,
      is_active: input.is_active,
    })
    .eq('id', input.id);

  if (error) return fail(error.message);

  revalidatePath('/admin/users');
  return ok('Account updated.');
}

/** One-click activate / deactivate from the users table. */
export async function toggleUserActiveAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();

  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('is_active') ?? '') === 'on';

  if (!z.uuid().safeParse(id).success) return fail('Invalid user id.');
  if (id === actor.id && !next) return fail('You cannot deactivate your own account.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: next })
    .eq('id', id);

  if (error) return fail(error.message);

  revalidatePath('/admin/users');
  return ok(next ? 'Account reactivated.' : 'Account deactivated.');
}

/**
 * Super-admin password reset (e.g. a forgotten temporary password).
 * Only auth.admin can write to auth.users - the profile row is untouched.
 */
export async function resetUserPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = resetPasswordSchema.safeParse({
    id: formData.get('id'),
    password: formData.get('password'),
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });

  if (error) return fail(error.message);

  return ok('Password reset. The user can now sign in with the new password.');
}
