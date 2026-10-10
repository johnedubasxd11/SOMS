'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa } from '@/lib/auth';
import { safeFileName, readable } from '@/lib/actions/shared';
import { createClient } from '@/lib/supabase/server';
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/validations/submissions';
import { z } from 'zod';

/**
 * Template library actions (Phase 7). The `templates` table is versioned
 * exactly like `documents`: an upload never overwrites - it inserts a new row
 * (version + 1, parent_id = the row it supersedes) and flips the old row's
 * is_active to false. Every signed-in user reads; only OSA writes (RLS).
 */

const templateCategorySchema = z.enum([
  'proposal_form',
  'liquidation_form',
  'accomplishment_report',
  'other',
]);

const templateMetaSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  category: templateCategorySchema,
});

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

/** OSA uploads the first version of a new template. */
export async function uploadTemplateAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const parsed = templateMetaSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    category: formData.get('category'),
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choose a file to upload.');
  }
  const fileError = validateFile(file);
  if (fileError) return fail(fileError);

  const supabase = await createClient();
  const templateId = crypto.randomUUID();
  const path = `${templateId}/${safeFileName(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from('templates')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return fail(`${file.name}: ${storageError.message}`);

  const { error: insertError } = await supabase.from('templates').insert({
    id: templateId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: profile.id,
  });

  if (insertError) {
    await supabase.storage.from('templates').remove([path]);
    return fail(readable(insertError));
  }

  revalidatePath('/templates');
  revalidatePath('/osa/templates');
  return ok(`Template "${parsed.data.name}" uploaded as version 1.`);
}

/** OSA uploads a new version of an existing template. */
export async function replaceTemplateAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const templateId = formData.get('template_id');
  if (!z.uuid().safeParse(templateId).success) {
    return fail('Invalid template id.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choose the replacement file.');
  }
  const fileError = validateFile(file);
  if (fileError) return fail(fileError);

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from('templates')
    .select('id, name, description, category, version, is_active')
    .eq('id', templateId as string)
    .maybeSingle();

  if (!parent) return fail('Template not found.');
  if (!parent.is_active) {
    return fail('Only the active version can be replaced - restore it first.');
  }

  const newId = crypto.randomUUID();
  const path = `${newId}/${safeFileName(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from('templates')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return fail(`${file.name}: ${storageError.message}`);

  const { error: insertError } = await supabase.from('templates').insert({
    id: newId,
    name: parent.name,
    description: parent.description,
    category: parent.category,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: file.type,
    size_bytes: file.size,
    parent_id: parent.id,
    version: parent.version + 1,
    uploaded_by: profile.id,
  });

  if (insertError) {
    await supabase.storage.from('templates').remove([path]);
    return fail(readable(insertError));
  }

  await supabase.from('templates').update({ is_active: false }).eq('id', parent.id);

  revalidatePath('/templates');
  revalidatePath('/osa/templates');
  return ok(
    `Uploaded as version ${parent.version + 1} - the previous version stays downloadable.`
  );
}

/** OSA retires the active version (the previous version becomes active again). */
export async function deleteTemplateAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const templateId = formData.get('template_id');
  if (!z.uuid().safeParse(templateId).success) return fail('Invalid template id.');

  const supabase = await createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('id, storage_path, parent_id, is_active')
    .eq('id', templateId as string)
    .maybeSingle();

  if (!template) return fail('Template not found.');

  await supabase.storage.from('templates').remove([template.storage_path]);

  // Deleting an active version restores the previous one, mirroring
  // deleteAttachmentAction on documents.
  if (template.is_active && template.parent_id) {
    await supabase
      .from('templates')
      .update({ is_active: true })
      .eq('id', template.parent_id);
  }

  const { error } = await supabase.from('templates').delete().eq('id', template.id);
  if (error) return fail(readable(error));

  revalidatePath('/templates');
  revalidatePath('/osa/templates');
  return ok('Template version removed.');
}
