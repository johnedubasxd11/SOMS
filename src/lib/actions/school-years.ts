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

/**
 * Super admin: archives (or unarchives) a school year. Archived years are
 * read-only for everyone - the `enforce_archived_school_year` trigger in the
 * database refuses INSERT/UPDATE/DELETE on every year-scoped table. The
 * current year can never be archived (switch first).
 */
export async function setSchoolYearArchivedAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const id = formData.get('id');
  if (!z.uuid().safeParse(id).success) return fail('Invalid school year id.');

  const archived = formData.get('archived') === 'on';
  const supabase = await createClient();

  const { data: year } = await supabase
    .from('school_years')
    .select('id, name, is_current, is_archived')
    .eq('id', id as string)
    .maybeSingle();
  if (!year) return fail('School year not found.');
  if (year.is_current && archived) {
    return fail(
      `"${year.name}" is the current school year - make another year current before archiving it.`
    );
  }

  const { error } = await supabase
    .from('school_years')
    .update({ is_archived: archived })
    .eq('id', year.id);
  if (error) return fail(error.message);

  revalidatePath('/admin/school-years');
  return ok(
    archived
      ? `"${year.name}" archived - its records are now read-only.`
      : `"${year.name}" restored - its records are editable again.`
  );
}

/**
 * Super admin: one-click rollover - create the next school year (the day
 * after the current one ends, same length), make it current and archive the
 * old year. Refuses when the current year is already archived or overlaps
 * an existing year.
 */
export async function rolloverSchoolYearAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  void formData; // rollover needs no inputs - it derives the next year.
  await requireSuperAdmin();

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('school_years')
    .select('id, name, start_date, end_date, is_archived')
    .eq('is_current', true)
    .maybeSingle();
  if (!current) return fail('No current school year is configured.');
  if (current.is_archived) {
    return fail('The current school year is archived - unarchive it first.');
  }

  const start = new Date(`${current.end_date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const newName = `${start.getUTCFullYear()}-${end.getUTCFullYear()}`;

  const { data: clash } = await supabase
    .from('school_years')
    .select('id')
    .lte('start_date', fmt(end))
    .gte('end_date', fmt(start))
    .neq('id', current.id)
    .limit(1)
    .maybeSingle();
  if (clash) {
    return fail(
      `A school year already overlaps ${fmt(start)} - ${fmt(end)}. Create or edit it manually.`
    );
  }

  const { error: clearError } = await supabase
    .from('school_years')
    .update({ is_current: false })
    .eq('is_current', true);
  if (clearError) return fail(clearError.message);

  const { data: created, error: insertError } = await supabase
    .from('school_years')
    .insert({
      name: newName,
      start_date: fmt(start),
      end_date: fmt(end),
      is_current: true,
    })
    .select('id, name')
    .single();
  if (insertError) {
    if (/duplicate/i.test(insertError.message)) {
      return fail(`School year ${newName} already exists.`);
    }
    return fail(insertError.message);
  }

  const { error: archiveError } = await supabase
    .from('school_years')
    .update({ is_archived: true })
    .eq('id', current.id);
  if (archiveError) return fail(archiveError.message);

  revalidatePath('/admin/school-years');
  return ok(
    `Rolled over to ${created.name} - "${current.name}" is now archived and read-only.`
  );
}
