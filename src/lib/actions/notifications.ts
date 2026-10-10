'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Notification actions. RLS only ever exposes the caller's own rows
 * (notifications_select: user_id = auth.uid()), so these update statements
 * can only ever touch the signed-in user's inbox - no id can be forged into
 * somebody else's notification.
 */

const markOneSchema = z.object({ id: z.uuid('Invalid notification id') });

/** Marks a single notification as read. */
export async function markNotificationReadAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireProfile();

  const parsed = markOneSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('is_read', false);

  // 0 rows updated is not an error: the row was already read (or raced).
  if (error) return fail(readableError(error.message));

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  return ok();
}

/**
 * Marks every unread notification of the caller as read. Plain void return so
 * it can be wired straight to a <form action={...}>.
 */
export async function markAllNotificationsReadAction(): Promise<void> {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('is_read', false);

  if (error) {
    console.error('[notifications] mark all failed:', error.message);
    return;
  }

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

function readableError(message: string): string {
  return message.slice(0, 300);
}
