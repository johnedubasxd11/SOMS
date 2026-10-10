'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateOrganizationSchema } from '@/lib/validations/organizations';

function toNumber(value: FormDataEntryValue | null): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Accreditation, membership size and active flag - OSA only. */
export async function updateOrganizationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = updateOrganizationSchema.safeParse({
    id: formData.get('id'),
    description: formData.get('description') ?? '',
    accreditation_status: formData.get('accreditation_status'),
    accreditation_valid_until: formData.get('accreditation_valid_until') ?? '',
    // FormData only carries strings - turn it into a real number so zod's
    // z.number() can validate it (and report "Enter a number" for junk).
    membership_count: toNumber(formData.get('membership_count')),
    is_active: formData.get('is_active') === 'on',
  });

  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('organizations')
    .update({
      description: input.description?.trim() || null,
      accreditation_status: input.accreditation_status,
      accreditation_valid_until: input.accreditation_valid_until || null,
      membership_count: input.membership_count,
      is_active: input.is_active,
    })
    .eq('id', input.id);

  if (error) return fail(error.message);

  revalidatePath('/organizations');
  revalidatePath(`/organizations/${input.id}`);
  return ok('Organization record updated.');
}
