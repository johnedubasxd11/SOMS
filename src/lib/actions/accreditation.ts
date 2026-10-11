'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa, requireProfile } from '@/lib/auth';
import { emailPendingNotifications } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { asString, currentSchoolYear, readable, safeFileName } from './shared';
import {
  accreditationItemSchema,
  accreditationReviewSchema,
} from '@/lib/validations/accreditation';
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/validations/submissions';

/**
 * Accreditation checklist (Phase 6): OSA defines the items per school year,
 * every organization uploads one file per item, OSA approves or rejects each
 * upload. Files live in the `org-documents` bucket under
 * `{organization_id}/accreditation/{item_id}/{filename}` so the existing
 * org-scoped storage policies apply unchanged.
 */

function revalidateAccreditation() {
  revalidatePath('/accreditation');
  revalidatePath('/osa/accreditation');
  revalidatePath('/dashboard');
}

function validateFile(file: File): string | null {
  if (!ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_MIME_TYPES)[number])) {
    return `${file.name}: only PDF, DOC, DOCX, XLS, XLSX, JPG and PNG files are allowed.`;
  }
  if (file.size === 0) return `${file.name}: the file is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name}: files may not exceed 10 MB.`;
  }
  return null;
}

/** OSA: adds a checklist item for a school year (defaults to the current one). */
export async function createAccreditationItemAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = accreditationItemSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    sort_order: formData.get('sort_order') || '0',
    is_required: formData.getAll('is_required').includes('on'),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const schoolYearId = asString(formData.get('school_year_id'));
  const schoolYear = schoolYearId
    ? { id: schoolYearId }
    : await currentSchoolYear(supabase);
  if (!schoolYear) {
    return fail('No current school year is configured. Ask an administrator to set one.');
  }

  const { error } = await supabase.from('accreditation_items').insert({
    school_year_id: schoolYear.id,
    title: parsed.data.title,
    description: parsed.data.description?.trim() || null,
    sort_order: parsed.data.sort_order,
    is_required: parsed.data.is_required,
  });
  if (error) {
    if (/duplicate/i.test(error.message)) {
      return fail(`"${parsed.data.title}" is already on this year's checklist.`);
    }
    return fail(readable(error));
  }

  revalidateAccreditation();
  return ok(`Checklist item "${parsed.data.title}" added.`);
}

/** OSA: edits a checklist item (wording, order, required flag). */
export async function updateAccreditationItemAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = accreditationItemSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    sort_order: formData.get('sort_order') || '0',
    is_required: formData.getAll('is_required').includes('on'),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fail('Invalid checklist item id.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('accreditation_items')
    .update({
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      sort_order: parsed.data.sort_order,
      is_required: parsed.data.is_required,
    })
    .eq('id', id);
  if (error) {
    if (/duplicate/i.test(error.message)) {
      return fail(`"${parsed.data.title}" is already on this year's checklist.`);
    }
    return fail(readable(error));
  }

  revalidateAccreditation();
  return ok('Checklist item updated.');
}

/** OSA: removes an item (and every upload under it, via cascade). */
export async function deleteAccreditationItemAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fail('Invalid checklist item id.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('accreditation_items').delete().eq('id', id);
  if (error) return fail(readable(error));

  revalidateAccreditation();
  return ok('Checklist item removed.');
}

/**
 * Organization officers: upload (or replace) their file for one checklist
 * item. Replacing a rejected upload resets it to pending; replacing a
 * pending upload keeps it pending. Approved uploads are frozen for the org.
 */
export async function uploadAccreditationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== 'officer' || !profile.organization_id) {
    return fail('Only organization officers can upload accreditation files.');
  }

  const itemId = formData.get('item_id');
  if (typeof itemId !== 'string' || !/^[0-9a-f-]{36}$/i.test(itemId)) {
    return fail('Invalid checklist item id.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choose a file to upload.');
  }
  const fileError = validateFile(file);
  if (fileError) return fail(fileError);

  const supabase = await createClient();
  const { data: item } = await supabase
    .from('accreditation_items')
    .select('id, title, school_year_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) return fail('Checklist item not found.');

  const { data: existing } = await supabase
    .from('accreditation_submissions')
    .select('id, status, storage_path')
    .eq('item_id', itemId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (existing?.status === 'approved') {
    return fail('This item was already approved - ask OSA if you need to replace the file.');
  }

  const orgId = profile.organization_id;
  if (!orgId) return fail('Your account is not linked to an organization.');

  const subId = existing?.id ?? crypto.randomUUID();
  const path = `${orgId}/accreditation/${itemId}/${subId}/${safeFileName(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from('org-documents')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return fail(`${file.name}: ${storageError.message}`);

  if (existing) {
    const { error: updateError } = await supabase
      .from('accreditation_submissions')
      .update({
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
        status: 'pending',
        remarks: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_by: profile.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updateError) {
      await supabase.storage.from('org-documents').remove([path]);
      return fail(readable(updateError));
    }
    if (existing.storage_path !== path) {
      await supabase.storage.from('org-documents').remove([existing.storage_path]);
    }
  } else {
    const { error: insertError } = await supabase
      .from('accreditation_submissions')
      .insert({
        id: subId,
        item_id: itemId,
        organization_id: orgId,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
        submitted_by: profile.id,
      });
    if (insertError) {
      await supabase.storage.from('org-documents').remove([path]);
      return fail(readable(insertError));
    }
  }

  await supabase.rpc('notify_osa_staff', {
    p_type: 'accreditation',
    p_title: `Accreditation upload: ${item.title}`,
    p_body: `${profile.full_name} uploaded a file for "${item.title}".`,
    p_link: '/osa/accreditation',
  });
  await emailPendingNotifications({
    types: ['accreditation'],
    since: new Date(Date.now() - 60 * 1000),
  });

  revalidateAccreditation();
  return ok(existing ? 'File replaced - it is back with OSA as pending.' : 'File uploaded - it is now pending OSA review.');
}

/** Organization officers: withdraw a pending (or rejected) upload. */
export async function deleteAccreditationSubmissionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProfile();

  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fail('Invalid upload id.');
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('accreditation_submissions')
    .select('id, storage_path, status')
    .eq('id', id)
    .maybeSingle();
  if (!row) return fail('Upload not found.');
  if (row.status === 'approved') {
    return fail('Approved uploads cannot be removed - ask OSA.');
  }

  const { error } = await supabase
    .from('accreditation_submissions')
    .delete()
    .eq('id', id);
  if (error) return fail(readable(error));
  await supabase.storage.from('org-documents').remove([row.storage_path]);

  revalidateAccreditation();
  return ok('Upload removed.');
}

/** OSA: approves or rejects one organization's upload (remarks required on reject). */
export async function reviewAccreditationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const parsed = accreditationReviewSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    remarks: formData.get('remarks') || undefined,
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('accreditation_submissions')
    .select('id, status, organization_id, remarks, item:accreditation_items(title)')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!before) return fail('Upload not found.');

  const { error } = await supabase
    .from('accreditation_submissions')
    .update({
      status: parsed.data.status,
      remarks: parsed.data.remarks?.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id);
  if (error) return fail(readable(error));

  const title = Array.isArray(before.item) ? before.item[0]?.title : before.item?.title;
  const { data: notified } = await supabase.rpc('notify_org_officers', {
    p_organization_id: before.organization_id,
    p_type: 'accreditation',
    p_title: `Accreditation ${parsed.data.status}: ${title ?? 'upload'}`,
    p_body: parsed.data.status === 'approved'
      ? `OSA approved your upload for "${title ?? 'the checklist item'}".`
      : `OSA rejected your upload for "${title ?? 'the checklist item'}". ${parsed.data.remarks ?? ''}`.trim(),
    p_link: '/accreditation',
  });
  if (notified?.length) {
    await emailPendingNotifications({ ids: notified as string[] });
  }

  revalidateAccreditation();
  return ok(
    parsed.data.status === 'approved'
      ? 'Upload approved.'
      : 'Upload rejected - the organization can re-upload.'
  );
}
