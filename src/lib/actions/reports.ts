'use server';

import { redirect } from 'next/navigation';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SUBMISSION_MODULES } from '@/lib/submissions';
import { reportSchema } from '@/lib/validations/reports';
import {
  asString,
  currentSchoolYear,
  isUuid,
  readable,
  revalidateSubmission,
  toNumber,
} from './shared';
import { resolveOrgScope } from './submissions';

const MODULE = SUBMISSION_MODULES.reports;

function readReportFields(formData: FormData) {
  return {
    id: asString(formData.get('id')) || undefined,
    title: asString(formData.get('title')),
    summary: asString(formData.get('summary')),
    outcomes: asString(formData.get('outcomes')),
    attendance_count: toNumber(formData.get('attendance_count')),
    budget_spent: toNumber(formData.get('budget_spent')),
    liquidation_summary: asString(formData.get('liquidation_summary')),
    proposal_id: asString(formData.get('proposal_id')),
  };
}

function reportValues(input: {
  title: string;
  summary?: string;
  outcomes?: string;
  attendance_count: number;
  budget_spent: number;
  liquidation_summary?: string;
}) {
  return {
    title: input.title,
    summary: input.summary?.trim() || null,
    outcomes: input.outcomes?.trim() || null,
    attendance_count: input.attendance_count,
    budget_spent: input.budget_spent,
    liquidation_summary: input.liquidation_summary?.trim() || null,
  };
}

/**
 * The linked activity must be an approved proposal of the same organization -
 * an accomplishment report always describes something that already happened.
 */
async function resolveProposal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proposalId: string,
  organizationId: string
): Promise<{ id: string } | { error: string }> {
  if (!proposalId) return { id: '' };

  if (!isUuid(proposalId)) return { error: 'Invalid linked activity.' };

  const { data } = await supabase
    .from('activity_proposals')
    .select('id, status, organization_id')
    .eq('id', proposalId)
    .maybeSingle();

  if (!data) return { error: 'Linked activity not found.' };
  if (data.organization_id !== organizationId) {
    return { error: 'You can only link a proposal of your own organization.' };
  }
  if (data.status !== 'approved') {
    return { error: 'You can only link an approved activity proposal.' };
  }
  return { id: data.id };
}

/** Officer-only: accomplishment report for an activity of their organization. */
export async function createReportAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const scope = await resolveOrgScope(MODULE, profile);
  if ('error' in scope) return fail(scope.error);

  const parsed = reportSchema.safeParse(readReportFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);
  if (!schoolYear) {
    return fail('No current school year is configured. Ask an administrator to set one.');
  }

  const linked = await resolveProposal(
    supabase,
    parsed.data.proposal_id ?? '',
    scope.organizationId
  );
  if ('error' in linked) return fail(linked.error);

  const { data, error } = await supabase
    .from(MODULE.table)
    .insert({
      organization_id: scope.organizationId,
      school_year_id: schoolYear.id,
      created_by: profile.id,
      proposal_id: linked.id || null,
      ...reportValues(parsed.data),
    })
    .select('id')
    .single();

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, data.id);
  redirect(`${MODULE.basePath}/${data.id}`);
}

/** Edits a draft (or a report sent back for revision). */
export async function updateReportAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = reportSchema.safeParse(readReportFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));
  if (!parsed.data.id) return fail('Invalid report id.');

  const supabase = await createClient();
  const { data: row } = await supabase
    .from(MODULE.table)
    .select('id, status, created_by, organization_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!row) return fail('Report not found.');
  if (!['draft', 'revision_requested'].includes(row.status)) {
    return fail('This report can no longer be edited.');
  }
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  if (row.created_by !== profile.id && !isOsa) {
    return fail('Only the officer who created this report can edit it.');
  }

  const linked = await resolveProposal(supabase, parsed.data.proposal_id ?? '', row.organization_id);
  if ('error' in linked) return fail(linked.error);

  const { error } = await supabase
    .from(MODULE.table)
    .update({
      ...reportValues(parsed.data),
      proposal_id: linked.id || null,
    })
    .eq('id', row.id);

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, row.id);
  return ok('Report saved.');
}
