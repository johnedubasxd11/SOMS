'use server';

import { redirect } from 'next/navigation';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SUBMISSION_MODULES } from '@/lib/submissions';
import { otherDocumentSchema } from '@/lib/validations/other-documents';
import {
  asString,
  currentSchoolYear,
  readable,
  revalidateSubmission,
} from './shared';
import { resolveOrgScope } from './submissions';

const MODULE = SUBMISSION_MODULES.documents;

function readDocumentFields(formData: FormData) {
  return {
    id: asString(formData.get('id')) || undefined,
    title: asString(formData.get('title')),
    description: asString(formData.get('description')),
    category: asString(formData.get('category')),
  };
}

function documentValues(input: {
  title: string;
  description?: string;
  category: string;
}) {
  return {
    title: input.title,
    description: input.description?.trim() || null,
    category: input.category as
      | 'constitution_by_laws'
      | 'resolution'
      | 'memo'
      | 'minutes'
      | 'other',
  };
}

/** Officer-only: a governed document of their own organization. */
export async function createOtherDocumentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const scope = await resolveOrgScope(MODULE, profile);
  if ('error' in scope) return fail(scope.error);

  const parsed = otherDocumentSchema.safeParse(readDocumentFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);
  if (!schoolYear) {
    return fail('No current school year is configured. Ask an administrator to set one.');
  }

  const { data, error } = await supabase
    .from(MODULE.table)
    .insert({
      organization_id: scope.organizationId,
      school_year_id: schoolYear.id,
      created_by: profile.id,
      ...documentValues(parsed.data),
    })
    .select('id')
    .single();

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, data.id);
  redirect(`${MODULE.basePath}/${data.id}`);
}

/** Edits a draft (or a document sent back for revision). */
export async function updateOtherDocumentAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = otherDocumentSchema.safeParse(readDocumentFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));
  if (!parsed.data.id) return fail('Invalid document id.');

  const supabase = await createClient();
  const { data: row } = await supabase
    .from(MODULE.table)
    .select('id, status, created_by')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!row) return fail('Document not found.');
  if (!['draft', 'revision_requested'].includes(row.status)) {
    return fail('This document can no longer be edited.');
  }
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  if (row.created_by !== profile.id && !isOsa) {
    return fail('Only the officer who created this document can edit it.');
  }

  const { error } = await supabase
    .from(MODULE.table)
    .update(documentValues(parsed.data))
    .eq('id', row.id);

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, row.id);
  return ok('Document saved.');
}
