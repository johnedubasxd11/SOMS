'use server';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile, type Profile } from '@/lib/auth';
import { emailPendingNotifications } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { getModule, moduleForRecordType, type SubmissionModule } from '@/lib/submissions';
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_REQUEST,
  REMARKS_REQUIRED_STATUSES,
  commentSchema,
  transitionSchema,
} from '@/lib/validations/submissions';
import { asString, isUuid, readable, revalidateSubmission, safeFileName } from './shared';

/**
 * Workflow actions shared by every submission module (proposals, reports,
 * other documents, audit documents). The module key in the form decides which
 * table and which `record_type` the RPC works on - never a value the client
 * can invent, because `getModule()` only accepts known keys.
 */

/** adviser / OSA / officer checks are done by the RPC, this is the gate. */
export async function transitionSubmissionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProfile();

  const parsed = transitionSchema.safeParse({
    id: asString(formData.get('id')),
    module: asString(formData.get('module')),
    to_status: asString(formData.get('to_status')),
    remarks: asString(formData.get('remarks')),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const mod = getModule(parsed.data.module);
  if (!mod) return fail('Unknown submission type.');

  const { id, to_status, remarks } = parsed.data;
  if (REMARKS_REQUIRED_STATUSES.includes(to_status) && !remarks) {
    return fail('Remarks are required for this action.');
  }

  const supabase = await createClient();
  const { data: newStatus, error } = await supabase.rpc('transition_submission', {
    p_record_type: mod.recordType,
    p_record_id: id,
    p_to_status: to_status,
    p_remarks: remarks || undefined,
  });

  if (error) return fail(readable(error));

  // The RPC wrote the notifications in the same transaction; mirror them to
  // e-mail (in-app delivery already happened).
  await emailPendingNotifications({ recordType: mod.recordType, recordId: id });

  revalidateSubmission(mod, id);
  // The chain decides the resulting status (e.g. the adviser's "approve"
  // moves a multi-step record to endorsed), so prefer what came back.
  const finalStatus = (typeof newStatus === 'string' ? newStatus : to_status)
    .replace('_', ' ');
  return ok(`${mod.label} is now ${finalStatus}.`);
}

/** Adviser / dean / OSA remark that does not move the workflow. */
export async function addSubmissionCommentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (
    profile.role !== 'adviser' &&
    profile.role !== 'dean' &&
    profile.role !== 'osa_admin' &&
    profile.role !== 'super_admin'
  ) {
    return fail('Only advisers, deans and OSA may post review remarks.');
  }

  const parsed = commentSchema.safeParse({
    id: asString(formData.get('id')),
    module: asString(formData.get('module')),
    remarks: asString(formData.get('remarks')),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const mod = getModule(parsed.data.module);
  if (!mod) return fail('Unknown submission type.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('add_review_comment', {
    p_record_type: mod.recordType,
    p_record_id: parsed.data.id,
    p_remarks: parsed.data.remarks,
  });

  if (error) return fail(readable(error));

  await emailPendingNotifications({
    recordType: mod.recordType,
    recordId: parsed.data.id,
  });

  revalidateSubmission(mod, parsed.data.id);
  return ok('Remark posted.');
}

/**
 * Stores attachments in the private `submissions` bucket + documents rows.
 *
 * Files are versioned, never overwritten: uploading a file that replaces an
 * existing one (same name, or an explicit "new version" request) inserts a
 * new row with parent_id/version pointing at the old one and marks the old
 * row inactive - its storage path (and download link) stays forever.
 */
export async function uploadAttachmentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const recordId = asString(formData.get('id'));
  const mod = getModule(asString(formData.get('module')));
  if (!mod) return fail('Unknown submission type.');
  if (!isUuid(recordId)) return fail('Invalid record id.');

  const replaceId = asString(formData.get('replace_document_id')) || undefined;

  const files = formData
    .getAll('file')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return fail('Choose a file to attach.');
  if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
    return fail(`Attach at most ${MAX_ATTACHMENTS_PER_REQUEST} files at a time.`);
  }
  if (replaceId && files.length > 1) {
    return fail('Upload one file at a time when replacing a version.');
  }

  const supabase = await createClient();
  const { data: record } = await supabase
    .from(mod.table)
    .select('id, status, organization_id')
    .eq('id', recordId)
    .maybeSingle();

  if (!record) return fail(`${mod.label} not found.`);

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const isOfficerOfOrg =
    profile.role === 'officer' && profile.organization_id === record.organization_id;

  if (!isOsa && !isOfficerOfOrg) {
    return fail(`You cannot attach files to this ${mod.label.toLowerCase()}.`);
  }
  if (!isOsa && !['draft', 'revision_requested'].includes(record.status)) {
    return fail('Attachments can only be added while the record is editable.');
  }

  for (const file of files) {
    if (
      !ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_MIME_TYPES)[number])
    ) {
      return fail(
        `${file.name}: only PDF, DOC, DOCX, XLS, XLSX, JPG and PNG files are allowed.`
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return fail(`${file.name}: files may not exceed 10 MB.`);
    }
  }

  // The file this upload supersedes: explicit request, or an active file of
  // the record that carries the same name.
  const { data: activeFiles } = await supabase
    .from('documents')
    .select('id, file_name, version, is_active')
    .eq('record_type', mod.recordType)
    .eq('record_id', record.id)
    .eq('is_active', true);

  let parent =
    replaceId != null
      ? (activeFiles ?? []).find((file) => file.id === replaceId) ?? null
      : null;

  if (replaceId && !parent) {
    return fail('That file is not an active attachment of this record.');
  }

  if (!parent && !replaceId) {
    const sameName = (activeFiles ?? []).find(
      (file) => file.file_name.toLowerCase() === files[0].name.toLowerCase()
    );
    parent = sameName ?? null;
  }

  const uploaded: string[] = [];

  for (const file of files) {
    const path = `${record.organization_id}/${mod.storageModule}/${record.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const { error: storageError } = await supabase.storage
      .from('submissions')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (storageError) {
      await supabase.storage.from('submissions').remove(uploaded);
      return fail(`${file.name}: ${storageError.message}`);
    }
    uploaded.push(path);

    const { error: insertError } = await supabase.from('documents').insert({
      bucket: 'submissions',
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      doc_type: mod.docType,
      record_type: mod.recordType,
      record_id: record.id,
      organization_id: record.organization_id,
      uploaded_by: profile.id,
      parent_id: parent?.id ?? null,
      version: parent ? parent.version + 1 : 1,
    });

    if (insertError) {
      await supabase.storage.from('submissions').remove(uploaded);
      return fail(`${file.name}: ${insertError.message}`);
    }
  }

  if (parent) {
    await supabase.from('documents').update({ is_active: false }).eq('id', parent.id);
  }

  revalidateSubmission(mod, record.id);
  return ok(
    parent
      ? `Uploaded as version ${parent.version + 1} - the previous version stays downloadable.`
      : `${files.length} file${files.length > 1 ? 's' : ''} attached.`
  );
}

/** Removes a file that is still editable (uploader or OSA). */
export async function deleteAttachmentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const documentId = asString(formData.get('document_id'));
  if (!isUuid(documentId)) return fail('Invalid file id.');

  const supabase = await createClient();
  const { data: document } = await supabase
    .from('documents')
    .select('id, storage_path, bucket, uploaded_by, record_id, record_type, parent_id')
    .eq('id', documentId)
    .maybeSingle();

  const mod = moduleForRecordType(document?.record_type);
  if (!document || !mod || !document.record_id) {
    return fail('File not found.');
  }

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  if (!isOsa && document.uploaded_by !== profile.id) {
    return fail('Only the person who uploaded this file (or OSA) can remove it.');
  }

  const { data: record } = await supabase
    .from(mod.table)
    .select('status')
    .eq('id', document.record_id)
    .maybeSingle();

  if (record && !isOsa && !['draft', 'revision_requested'].includes(record.status)) {
    return fail('Files can only be removed while the record is editable.');
  }

  await supabase.storage.from(document.bucket).remove([document.storage_path]);

  // Removing a newer version restores the previous one as the active file.
  if (document.parent_id) {
    await supabase
      .from('documents')
      .update({ is_active: true })
      .eq('id', document.parent_id);
  }

  const { error } = await supabase.from('documents').delete().eq('id', document.id);
  if (error) return fail(readable(error));

  revalidateSubmission(mod, document.record_id);
  return ok('File removed.');
}

/**
 * Create gate for the module actions: only the module's roles may create a
 * record, and they must belong to an organization (the org id is what the
 * insert uses - never a value coming from the client).
 */
export async function resolveOrgScope(
  mod: SubmissionModule,
  profile: Profile
): Promise<{ error: string } | { organizationId: string }> {
  if (!mod.createRoles.includes(profile.role)) {
    return {
      error: `Only ${mod.createRoles.join(' or ')} accounts may create a ${mod.label.toLowerCase()}.`,
    };
  }
  if (!profile.organization_id) {
    return { error: 'Your account is not linked to an organization.' };
  }
  return { organizationId: profile.organization_id };
}
