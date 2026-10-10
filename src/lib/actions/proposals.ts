'use server';

import { redirect } from 'next/navigation';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SUBMISSION_MODULES } from '@/lib/submissions';
import { proposalSchema } from '@/lib/validations/proposals';
import {
  asString,
  currentSchoolYear,
  readable,
  revalidateSubmission,
  toNumber,
} from './shared';
import { resolveOrgScope } from './submissions';

const MODULE = SUBMISSION_MODULES.proposals;

function readProposalFields(formData: FormData) {
  return {
    id: asString(formData.get('id')) || undefined,
    title: asString(formData.get('title')),
    description: asString(formData.get('description')),
    objectives: asString(formData.get('objectives')),
    activity_date: asString(formData.get('activity_date')),
    start_time: asString(formData.get('start_time')),
    end_time: asString(formData.get('end_time')),
    venue: asString(formData.get('venue')),
    venue_id: asString(formData.get('venue_id')) || undefined,
    participants_count: toNumber(formData.get('participants_count')),
    budget: toNumber(formData.get('budget')),
    source_of_funds: asString(formData.get('source_of_funds')),
  };
}

function proposalValues(input: {
  title: string;
  description?: string;
  objectives?: string;
  activity_date: string;
  start_time?: string;
  end_time?: string;
  venue: string;
  venue_id?: string;
  participants_count: number;
  budget: number;
  source_of_funds?: string;
}) {
  return {
    title: input.title,
    description: input.description?.trim() || null,
    objectives: input.objectives?.trim() || null,
    activity_date: input.activity_date,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    venue: input.venue,
    venue_id: input.venue_id || null,
    participants_count: input.participants_count,
    budget: input.budget,
    source_of_funds: input.source_of_funds?.trim() || null,
  };
}

/** Officer-only: creates a draft in their own organization for the current year. */
export async function createProposalAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const scope = await resolveOrgScope(MODULE, profile);
  if ('error' in scope) return fail(scope.error);

  const parsed = proposalSchema.safeParse(readProposalFields(formData));
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
      ...proposalValues(parsed.data),
    })
    .select('id')
    .single();

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, data.id);
  redirect(`${MODULE.basePath}/${data.id}`);
}

/** Edits a draft (or a proposal sent back for revision). */
export async function updateProposalAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = proposalSchema.safeParse(readProposalFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));
  if (!parsed.data.id) return fail('Invalid proposal id.');

  const supabase = await createClient();
  const { data: row } = await supabase
    .from(MODULE.table)
    .select('id, status, created_by')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (!row) return fail('Proposal not found.');
  if (!['draft', 'revision_requested'].includes(row.status)) {
    return fail('This proposal can no longer be edited.');
  }
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  if (row.created_by !== profile.id && !isOsa) {
    return fail('Only the officer who created this proposal can edit it.');
  }

  const { error } = await supabase
    .from(MODULE.table)
    .update(proposalValues(parsed.data))
    .eq('id', row.id);

  if (error) return fail(readable(error));

  revalidateSubmission(MODULE, row.id);
  return ok('Proposal saved.');
}
