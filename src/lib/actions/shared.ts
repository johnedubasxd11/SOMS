import { revalidatePath } from 'next/cache';

import type { SubmissionModule } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** FormData only carries strings - these keep the server actions readable. */
export function toNumber(value: FormDataEntryValue | null): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Postgres errors are shown as-is (they are already human readable). */
export function readable(error: { message: string }): string {
  return error.message.slice(0, 300);
}

/** Keeps storage paths free of surprises without renaming the file. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9 ._()-]/g, '_').slice(0, 80);
  return cleaned.trim() || 'file';
}

/** Every module belongs to exactly one school year - the current one. */
export async function currentSchoolYear(supabase: Supabase) {
  const { data } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle();
  return data ?? null;
}

export function revalidateSubmission(module: SubmissionModule, id: string) {
  revalidatePath(module.basePath);
  revalidatePath(`${module.basePath}/${id}`);
  revalidatePath('/osa/reviews');
  revalidatePath('/dashboard');
}
