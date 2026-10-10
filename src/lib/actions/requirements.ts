'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa, requireProfile } from '@/lib/auth';
import { emailPendingNotifications } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { asString, currentSchoolYear, readable } from './shared';
import {
  createRequirementSchema,
  updateRequirementSchema,
} from '@/lib/validations/requirements';

/**
 * Requirements are an OSA-driven compliance checklist: OSA creates them for
 * an organization, the organization's officers + advisers see their own rows
 * (RLS: requirements_select) and get notifications when one is assigned.
 *
 * Recipient rules live in notify_org_officers() - these actions call it and
 * only mirror the resulting rows to e-mail.
 */

function revalidateRequirements(id?: string) {
  revalidatePath('/requirements');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/requirements#${id}`);
}

/** OSA: assigns a new requirement to an organization. */
export async function createRequirementAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const parsed = createRequirementSchema.safeParse({
    organization_id: formData.get('organization_id'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    due_date: formData.get('due_date') || undefined,
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);
  if (!schoolYear) {
    return fail('No current school year is configured. Ask an administrator to set one.');
  }

  const { data, error } = await supabase
    .from('requirements')
    .insert({
      organization_id: parsed.data.organization_id,
      school_year_id: schoolYear.id,
      assigned_by: profile.id,
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      due_date: parsed.data.due_date || null,
    })
    .select('id, title, due_date, organizations(code, name)')
    .single();

  if (error) return fail(readable(error));

  const org = data.organizations;
  const dueText = data.due_date
    ? ` Due ${new Date(`${data.due_date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}.`
    : '';

  // Notify every officer + adviser of that organization (RLS-gated RPC).
  const { data: notifiedIds, error: notifyError } = await supabase.rpc(
    'notify_org_officers',
    {
      p_organization_id: parsed.data.organization_id,
      p_type: 'requirement',
      p_title: `New requirement: ${data.title}`,
      p_body: `${org?.name ?? 'Your organization'} has a new compliance requirement.${dueText}`,
      p_link: '/requirements',
    }
  );

  if (notifyError) {
    // The requirement itself was created - surface the notification problem.
    console.error('[requirements] notify_org_officers failed:', notifyError.message);
  } else if (notifiedIds?.length) {
    await emailPendingNotifications({ ids: notifiedIds as string[] });
  }

  revalidateRequirements(data.id);
  return ok(
    notifiedIds?.length
      ? `Requirement assigned - ${notifiedIds.length} officer${notifiedIds.length === 1 ? '' : 's'} notified.`
      : 'Requirement assigned.'
  );
}

/** OSA: edits wording/due date and moves the status along. */
export async function updateRequirementAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  // The edit dialog submits description/due_date; quick row actions (Complete /
  // Waive / Reopen) do not - those keep the stored values instead of nulling.
  const hasDescription = formData.has('description');
  const hasDueDate = formData.has('due_date');

  const parsed = updateRequirementSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    description: hasDescription ? asString(formData.get('description')) : undefined,
    due_date: hasDueDate ? asString(formData.get('due_date')) : undefined,
    status: formData.get('status') || 'open',
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('requirements')
    .select('id, status, organization_id, title, description, due_date, completed_at')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!before) return fail('Requirement not found.');

  const statusChanged = before.status !== parsed.data.status;
  const completedAt =
    parsed.data.status === 'completed'
      ? (before.completed_at ?? new Date().toISOString())
      : null;

  const { error } = await supabase
    .from('requirements')
    .update({
      title: parsed.data.title,
      description: hasDescription
        ? parsed.data.description?.trim() || null
        : before.description,
      due_date: hasDueDate ? parsed.data.due_date || null : before.due_date,
      status: parsed.data.status,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id);

  if (error) return fail(readable(error));

  if (statusChanged) {
    const label =
      parsed.data.status === 'completed'
        ? 'completed'
        : parsed.data.status === 'waived'
          ? 'waived'
          : 'reopened';
    const { data: notifiedIds } = await supabase.rpc('notify_org_officers', {
      p_organization_id: before.organization_id,
      p_type: 'requirement',
      p_title: `Requirement ${label}: ${before.title}`,
      p_body: `OSA marked "${before.title}" as ${label}.`,
      p_link: '/requirements',
    });
    if (notifiedIds?.length) {
      await emailPendingNotifications({ ids: notifiedIds as string[] });
    }
  }

  revalidateRequirements(parsed.data.id);
  return ok('Requirement updated.');
}

/** OSA: removes a requirement that was assigned by mistake. */
export async function deleteRequirementAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fail('Invalid requirement id.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('requirements').delete().eq('id', id);
  if (error) return fail(readable(error));

  revalidateRequirements();
  return ok('Requirement removed.');
}

/**
 * OSA: runs the deadline sweep on demand (marks overdue, sends due-soon
 * reminders at most once per requirement per day) and e-mails what it created.
 * The same function runs daily through pg_cron / the cron route.
 */
export async function runRequirementSweepAction(): Promise<ActionResult> {
  await requireProfile();
  await requireOsa();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('sweep_requirements', {
    p_reminder_days: 3,
  });

  if (error) return fail(readable(error));

  const emailed = await emailPendingNotifications({
    types: ['reminder', 'requirement'],
    since: new Date(Date.now() - 60 * 60 * 1000),
  });

  revalidateRequirements();
  const reminders = typeof data === 'number' ? data : 0;
  if (reminders === 0) return ok('Nothing to remind about right now.');
  return ok(
    `${reminders} reminder${reminders === 1 ? '' : 's'} sent${emailed ? `, ${emailed} e-mailed` : ''}.`
  );
}
