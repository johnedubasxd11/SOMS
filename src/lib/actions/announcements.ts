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
 * Announcement board actions (Phase 7). OSA composes; the audience is stored
 * in announcement_targets and the RLS policy on announcements computes who
 * may read each row. Posting also fans out in-app notifications through the
 * SECURITY DEFINER RPC notify_announcement_recipients().
 */

const announcementSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    body: z.string().trim().min(1, 'Body is required').max(5000),
    target_type: z.enum(['all', 'college', 'organization']),
    college_id: z.uuid().optional(),
    organization_id: z.uuid().optional(),
    expires_at: z.string().optional(),
    is_pinned: z.boolean(),
  })
  .refine(
    (data) =>
      data.target_type !== 'college' ||
      (data.college_id && z.uuid().safeParse(data.college_id).success),
    { message: 'Pick the college to target.', path: ['college_id'] }
  )
  .refine(
    (data) =>
      data.target_type !== 'organization' ||
      (data.organization_id && z.uuid().safeParse(data.organization_id).success),
    { message: 'Pick the organization to target.', path: ['organization_id'] }
  );

function validateFile(file: File): string | null {
  if (!ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_MIME_TYPES)[number])) {
    return `${file.name}: only PDF, DOC, DOCX, XLS, XLSX, JPG and PNG files are allowed.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name}: files may not exceed 10 MB.`;
  }
  return null;
}

/** OSA posts an announcement and notifies its audience. */
export async function createAnnouncementAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const rawExpires = formData.get('expires_at');
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    target_type: formData.get('target_type'),
    college_id: formData.get('college_id') || undefined,
    organization_id: formData.get('organization_id') || undefined,
    expires_at: typeof rawExpires === 'string' && rawExpires ? rawExpires : undefined,
    is_pinned: formData.get('is_pinned') === 'on',
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const file = formData.get('attachment');
  let attachment: { path: string; name: string; type: string; size: number } | null = null;
  if (file instanceof File && file.size > 0) {
    const fileError = validateFile(file);
    if (fileError) return fail(fileError);
    attachment = {
      path: '',
      name: file.name.slice(0, 200),
      type: file.type,
      size: file.size,
    };
  }

  const supabase = await createClient();

  // Expiry must be a future timestamp when set.
  let expiresAt: string | null = null;
  if (parsed.data.expires_at) {
    const date = new Date(parsed.data.expires_at);
    if (Number.isNaN(date.getTime())) return fail('Invalid expiry date.');
    if (date.getTime() <= Date.now()) {
      return fail('The expiry date must be in the future.');
    }
    expiresAt = date.toISOString();
  }

  const { data: announcement, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      target_type: parsed.data.target_type,
      is_pinned: parsed.data.is_pinned,
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (insertError) return fail(readable(insertError));

  if (parsed.data.target_type === 'college') {
    const { error } = await supabase.from('announcement_targets').insert({
      announcement_id: announcement.id,
      college_id: parsed.data.college_id,
    });
    if (error) {
      await supabase.from('announcements').delete().eq('id', announcement.id);
      return fail(readable(error));
    }
  } else if (parsed.data.target_type === 'organization') {
    const { error } = await supabase.from('announcement_targets').insert({
      announcement_id: announcement.id,
      organization_id: parsed.data.organization_id,
    });
    if (error) {
      await supabase.from('announcements').delete().eq('id', announcement.id);
      return fail(readable(error));
    }
  }

  if (attachment) {
    const path = `${announcement.id}/${safeFileName(file instanceof File ? file.name : 'attachment')}`;
    const { error: storageError } = await supabase.storage
      .from('announcements')
      .upload(path, file as File, { contentType: attachment.type, upsert: false });
    if (storageError) {
      await supabase.from('announcements').delete().eq('id', announcement.id);
      return fail(`${attachment.name}: ${storageError.message}`);
    }
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        attachment_path: path,
        attachment_file_name: attachment.name,
        attachment_mime_type: attachment.type,
        attachment_size_bytes: attachment.size,
      })
      .eq('id', announcement.id);
    if (updateError) {
      await supabase.storage.from('announcements').remove([path]);
      await supabase.from('announcements').delete().eq('id', announcement.id);
      return fail(readable(updateError));
    }
  }

  const { data: notified, error: rpcError } = await supabase.rpc(
    'notify_announcement_recipients',
    { p_announcement_id: announcement.id }
  );
  if (rpcError) {
    // The announcement itself is live; surface the notification failure.
    revalidatePath('/announcements');
    return fail(
      `Announcement posted, but notifications could not be sent: ${rpcError.message}`
    );
  }

  revalidatePath('/announcements');
  return ok(
    `Announcement posted - ${notified ?? 0} notification${notified === 1 ? '' : 's'} sent.`
  );
}

/** OSA removes an announcement (and its notifications stay in inboxes). */
export async function deleteAnnouncementAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const id = formData.get('id');
  if (!z.uuid().safeParse(id).success) return fail('Invalid announcement id.');

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('announcements')
    .select('id, attachment_path')
    .eq('id', id as string)
    .maybeSingle();

  if (!row) return fail('Announcement not found.');

  if (row.attachment_path) {
    await supabase.storage.from('announcements').remove([row.attachment_path]);
  }

  const { error } = await supabase.from('announcements').delete().eq('id', row.id);
  if (error) return fail(readable(error));

  revalidatePath('/announcements');
  return ok('Announcement removed.');
}
