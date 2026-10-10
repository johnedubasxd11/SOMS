'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createSchoolYearSchema } from '@/lib/validations/organizations';

export async function createSchoolYearAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = createSchoolYearSchema.safeParse({
    name: formData.get('name'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    is_current: formData.get('is_current') === 'on',
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const input = parsed.data;
  const supabase = await createClient();

  // Exactly one current school year (unique partial index in the schema).
  if (input.is_current) {
    const { error: clearError } = await supabase
      .from('school_years')
      .update({ is_current: false })
      .eq('is_current', true);
    if (clearError) return fail(clearError.message);
  }

  const { error } = await supabase.from('school_years').insert({
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    is_current: input.is_current,
  });

  if (error) {
    if (/duplicate/i.test(error.message)) {
      return fail(`School year ${input.name} already exists.`);
    }
    return fail(error.message);
  }

  revalidatePath('/admin/school-years');
  return ok(`School year ${input.name} created.`);
}

export async function setCurrentSchoolYearAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const id = formData.get('id');
  if (!z.uuid().safeParse(id).success) return fail('Invalid school year id.');

  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from('school_years')
    .update({ is_current: false })
    .eq('is_current', true);
  if (clearError) return fail(clearError.message);

  const { error } = await supabase
    .from('school_years')
    .update({ is_current: true })
    .eq('id', id as string);

  if (error) return fail(error.message);

  revalidatePath('/admin/school-years');
  return ok('Current school year updated.');
}
