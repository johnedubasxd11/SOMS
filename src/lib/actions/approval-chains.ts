'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  updateApprovalChainSchema,
} from '@/lib/validations/approval-chains';

/**
 * Replaces the steps of one approval chain. Only future submissions follow
 * the new order: every record snapshots its chain into approval_records when
 * it is submitted, so in-flight reviews keep the steps they started with.
 */
export async function updateApprovalChainAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = updateApprovalChainSchema.safeParse({
    chain_id: formData.get('chain_id'),
    step_roles: formData.get('step_roles'),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const { chain_id, step_roles } = parsed.data;
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from('approval_chain_steps')
    .delete()
    .eq('chain_id', chain_id);
  if (deleteError) return fail(readableError(deleteError.message));

  const { error: insertError } = await supabase.from('approval_chain_steps').insert(
    step_roles.map((role, index) => ({
      chain_id,
      step_number: index + 1,
      step_role: role,
    }))
  );
  if (insertError) return fail(readableError(insertError.message));

  revalidatePath('/osa/approval-chains');
  return ok(
    `Approval chain saved (${step_roles.length} step${step_roles.length === 1 ? '' : 's'}). New submissions will follow it.`
  );
}

function readableError(message: string): string {
  return message.replace(/\(SQLSTATE [^)]+\)/g, '').trim();
}
