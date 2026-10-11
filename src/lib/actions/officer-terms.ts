'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa, requireProfile } from '@/lib/auth';
import { emailPendingNotifications } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';
import { asString, currentSchoolYear, readable } from './shared';
import {
  officerTermReviewSchema,
  officerTermSchema,
} from '@/lib/validations/officer-terms';

/**
 * Officer-list turnover (Phase 6): the officers of an organization compose
 * the incoming officer list for the current school year (free-text names -
 * incoming officers may not have accounts yet) and submit it; OSA approves
 * or sends it back with notes. Members are frozen once the list leaves
 * draft (RLS: officer_term_members_write requires a draft term).
 */

function revalidateTurnover() {
  revalidatePath('/turnover');
  revalidatePath('/osa/turnover');
  revalidatePath('/dashboard');
}

/** Loads (or lazily creates) the caller's organization's draft term. */
async function ensureDraftTerm(supabase: Awaited<ReturnType<typeof createClient>>) {
  const profile = await requireProfile();
  if (profile.role !== 'officer' || !profile.organization_id) {
    return {
      ok: false as const,
      error: 'Only organization officers manage the officer list.',
    };
  }
  const schoolYear = await currentSchoolYear(supabase);
  if (!schoolYear) {
    return {
      ok: false as const,
      error: 'No current school year is configured. Ask an administrator to set one.',
    };
  }
  return {
    ok: true as const,
    organizationId: profile.organization_id,
    profile,
    schoolYear,
  };
}

/**
 * Officers: create or replace the draft list for the current school year.
 * The whole member list is replaced in one shot (names are re-posted from
 * the form, so there is no per-row edit dance to guard).
 */
export async function saveOfficerTermAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const gate = await ensureDraftTerm(supabase);
  if (!gate.ok) return fail(gate.error);
  const { profile, schoolYear, organizationId } = gate;

  let rawMembers: unknown;
  try {
    rawMembers = JSON.parse(asString(formData.get('members') || '[]'));
  } catch {
    return fail('The officer list was submitted in an unreadable format - reload and try again.');
  }
  const parsed = officerTermSchema.safeParse({
    notes: formData.get('notes') || undefined,
    members: rawMembers,
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const { data: existing } = await supabase
    .from('officer_terms')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('school_year_id', schoolYear.id)
    .maybeSingle();

  if (existing && existing.status !== 'draft') {
    return fail(
      existing.status === 'submitted'
        ? 'The list is with OSA - withdraw it first if you need to edit.'
        : 'The list was already approved - ask OSA if a correction is needed.'
    );
  }

  let termId: string;
  if (!existing) {
    const { data: created, error: insertError } = await supabase
      .from('officer_terms')
      .insert({
        organization_id: organizationId,
        school_year_id: schoolYear.id,
        notes: parsed.data.notes?.trim() || null,
        submitted_by: profile.id,
      })
      .select('id')
      .single();
    if (insertError) return fail(readable(insertError));
    termId = created.id;
  } else {
    termId = existing.id;
    const { error: updateError } = await supabase
      .from('officer_terms')
      .update({ notes: parsed.data.notes?.trim() || null })
      .eq('id', existing.id);
    if (updateError) return fail(readable(updateError));
  }

  // Replace the whole list: delete what is gone, insert what is new.
  const { data: currentMembers } = await supabase
    .from('officer_term_members')
    .select('id, full_name, position')
    .eq('term_id', termId);

  const keepNames = new Set(
    parsed.data.members.map((m) => `${m.full_name}::${m.position}`.toLowerCase())
  );
  for (const row of currentMembers ?? []) {
    const key = `${row.full_name}::${row.position}`.toLowerCase();
    if (!keepNames.has(key)) {
      await supabase.from('officer_term_members').delete().eq('id', row.id);
    }
  }

  for (const [index, member] of parsed.data.members.entries()) {
    const email = member.email?.trim() || null;
    const match = (currentMembers ?? []).find(
      (row) =>
        `${row.full_name}::${row.position}`.toLowerCase() ===
        `${member.full_name}::${member.position}`.toLowerCase()
    );
    if (match) {
      await supabase
        .from('officer_term_members')
        .update({ sort_order: index, email })
        .eq('id', match.id);
    } else {
      await supabase.from('officer_term_members').insert({
        term_id: termId,
        full_name: member.full_name,
        position: member.position,
        email,
        sort_order: index,
      });
    }
  }

  revalidateTurnover();
  return ok('Officer list saved as a draft.');
}

/** Officers: submit the draft list to OSA. */
export async function submitOfficerTermAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  void formData; // the status flip needs no form payload beyond the gate above.
  const supabase = await createClient();
  const gate = await ensureDraftTerm(supabase);
  if (!gate.ok) return fail(gate.error);
  const { profile, schoolYear, organizationId } = gate;

  const { data: term } = await supabase
    .from('officer_terms')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('school_year_id', schoolYear.id)
    .maybeSingle();
  if (!term) return fail('Save the officer list first.');
  if (term.status !== 'draft') {
    return fail('The list was already submitted.');
  }

  const { count } = await supabase
    .from('officer_term_members')
    .select('id', { count: 'exact', head: true })
    .eq('term_id', term.id);
  if (!count) return fail('Add at least one officer before submitting.');

  const { error } = await supabase
    .from('officer_terms')
    .update({
      status: 'submitted',
      submitted_by: profile.id,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', term.id);
  if (error) return fail(readable(error));

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  await supabase.rpc('notify_osa_staff', {
    p_type: 'turnover',
    p_title: `Officer list submitted: ${org?.name ?? 'organization'}`,
    p_body: `${profile.full_name} submitted the officer list for review.`,
    p_link: '/osa/turnover',
  });
  await emailPendingNotifications({
    types: ['turnover'],
    since: new Date(Date.now() - 60 * 1000),
  });

  revalidateTurnover();
  return ok('Officer list submitted to OSA.');
}

/** Officers: pull the list back from OSA (submitted -> draft). */
export async function withdrawOfficerTermAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const gate = await ensureDraftTerm(supabase);
  if (!gate.ok) return fail(gate.error);
  const { schoolYear, organizationId } = gate;

  const id = formData.get('id');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return fail('Invalid turnover id.');
  }

  const { error } = await supabase
    .from('officer_terms')
    .update({ status: 'draft', submitted_at: null, submitted_by: null })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .eq('school_year_id', schoolYear.id)
    .eq('status', 'submitted');
  if (error) return fail(readable(error));

  revalidateTurnover();
  return ok('Officer list withdrawn - it is back to draft.');
}

/** OSA: approve a submitted list, or send it back to draft with notes. */
export async function reviewOfficerTermAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireOsa();

  const parsed = officerTermReviewSchema.safeParse({
    id: formData.get('id'),
    action: formData.get('action'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) return fail(firstError(parsed.error.issues));

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('officer_terms')
    .select('id, status, notes, submitted_at, organization_id, organizations(name)')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!before) return fail('Turnover record not found.');
  if (before.status !== 'submitted') {
    return fail('Only submitted officer lists can be reviewed.');
  }

  const approve = parsed.data.action === 'approve';
  const { error } = await supabase
    .from('officer_terms')
    .update({
      status: approve ? 'approved' : 'draft',
      notes: parsed.data.notes?.trim() || before.notes || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      submitted_at: approve ? before.submitted_at : null,
    })
    .eq('id', parsed.data.id);
  if (error) return fail(readable(error));

  const org = Array.isArray(before.organizations)
    ? before.organizations[0]
    : before.organizations;

  await supabase.rpc('notify_org_officers', {
    p_organization_id: before.organization_id,
    p_type: 'turnover',
    p_title: approve
      ? `Officer list approved: ${org?.name ?? 'your organization'}`
      : `Officer list sent back: ${org?.name ?? 'your organization'}`,
    p_body: approve
      ? 'OSA approved your officer list for this school year.'
      : `OSA sent the officer list back for changes. ${parsed.data.notes ?? ''}`.trim(),
    p_link: '/turnover',
  });

  revalidateTurnover();
  return ok(approve ? 'Officer list approved.' : 'Officer list sent back to the organization.');
}
