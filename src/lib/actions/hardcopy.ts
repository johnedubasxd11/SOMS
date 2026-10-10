'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireRole } from '@/lib/auth';
import { emailPendingNotifications } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { moduleForRecordType } from '@/lib/submissions';
import { markHardcopySchema } from '@/lib/validations/submissions';
import { asString, readable } from './shared';

/**
 * OSA-only: logs the paper copy of a submission through
 * `mark_hardcopy_received()` (which re-checks the role, writes the hardcopy
 * record, the review log and the notifications in one transaction).
 */
export async function markHardcopyReceivedAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireRole('osa_admin', 'super_admin');

  const parsed = markHardcopySchema.safeParse({
    record_type: asString(formData.get('record_type')),
    record_id: asString(formData.get('record_id')),
    receiver_name: asString(formData.get('receiver_name')),
    remarks: asString(formData.get('remarks')) || undefined,
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_hardcopy_received', {
    p_record_type: parsed.data.record_type,
    p_record_id: parsed.data.record_id,
    p_receiver_name: parsed.data.receiver_name,
    p_remarks: parsed.data.remarks,
  });

  if (error) return fail(readable(error));

  await emailPendingNotifications({
    recordType: parsed.data.record_type,
    recordId: parsed.data.record_id,
  });

  revalidatePath('/osa/hardcopy');
  revalidatePath('/dashboard');
  const mod = moduleForRecordType(parsed.data.record_type);
  if (mod) {
    revalidatePath(mod.basePath);
    revalidatePath(`${mod.basePath}/${parsed.data.record_id}`);
  }

  return ok(`Hardcopy received - ${parsed.data.receiver_name}.`);
}
