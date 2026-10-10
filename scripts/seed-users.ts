/**
 * SOMS seed script - creates Auth users with the service role key and the
 * sample records that need a real profile (advisers, officers, proposals,
 * reports, documents, requirements).
 *
 *   npm run seed:auth
 *
 * Prerequisites:
 *   1. `npx supabase db reset` has run (colleges / orgs / school years exist)
 *   2. .env.local contains SUPABASE_SERVICE_ROLE_KEY (see .env.example)
 *
 * The script is idempotent: accounts are reused, and sample submissions are
 * only inserted once.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '../src/lib/database.types';

type Enums = Database['public']['Enums'];
type SubmissionStatus = Enums['submission_status'];
type UserRole = Enums['user_role'];

// ---------------------------------------------------------------------------
// Environment (.env.local is not read automatically outside Next.js)
// ---------------------------------------------------------------------------
function loadEnvFile(): void {
  const file = path.join(process.cwd(), '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Start Supabase (npx supabase start) and copy `npx supabase status -o env` into .env.local'
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface SeedUser {
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string;
  collegeId?: string;
  position?: string;
}

async function ensureUser(user: SeedUser): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (!error && data.user) return data.user.id;

  if (error && /already registered/i.test(error.message)) {
    // Reuse the existing account and make sure the password is known.
    const list = await db.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const existing = list.data.users.find((u) => u.email === user.email);
    if (!existing) throw new Error(`User ${user.email} not found after conflict`);
    await db.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }

  throw new Error(`createUser(${user.email}) failed: ${error?.message}`);
}

async function ensureProfile(userId: string, user: SeedUser): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({
      full_name: user.fullName,
      role: user.role,
      organization_id: user.organizationId ?? null,
      college_id: user.collegeId ?? null,
      position: user.position ?? null,
      is_active: true,
    })
    .eq('id', userId);
  if (error) throw new Error(`profile(${user.email}): ${error.message}`);
}

/** Proposal status lifecycle used to fake realistic review chains. */
const STATUS_CHAIN: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: [],
  submitted: ['submitted'],
  endorsed: ['submitted', 'endorsed'],
  under_review: ['submitted', 'endorsed', 'under_review'],
  revision_requested: ['submitted', 'endorsed', 'under_review', 'revision_requested'],
  approved: ['submitted', 'endorsed', 'under_review', 'approved'],
  rejected: ['submitted', 'endorsed', 'under_review', 'rejected'],
};

function isBefore(status: SubmissionStatus, target: SubmissionStatus): boolean {
  return STATUS_CHAIN[status].includes(target);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Instantiates the configured approval chain for every seeded submission. */
async function backfillApprovalInstances(): Promise<void> {
  const targets: [
    Enums['record_type'],
    'activity_proposals' | 'accomplishment_reports' | 'audit_documents' | 'other_documents',
  ][] = [
    ['activity_proposal', 'activity_proposals'],
    ['accomplishment_report', 'accomplishment_reports'],
    ['audit_document', 'audit_documents'],
    ['other_document', 'other_documents'],
  ];
  let count = 0;
  for (const [recordType, table] of targets) {
    const { data, error } = await db.from(table).select('id');
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data ?? []) {
      const { error: er } = await db.rpc('ensure_approval_instance', {
        p_record_type: recordType,
        p_record_id: row.id,
      });
      if (er) throw new Error(`ensure_approval_instance(${recordType}): ${er.message}`);
      count++;
    }
  }
  console.log(`approval chain instances ensured for ${count} submissions`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('SOMS seed ->', url);

  const { data: colleges, error: e1 } = await db.from('colleges').select('*');
  const { data: orgs, error: e2 } = await db
    .from('organizations')
    .select('*, colleges!inner(code)')
    .order('code');
  const { data: years, error: e3 } = await db
    .from('school_years')
    .select('*')
    .order('start_date');
  if (e1 || e2 || e3) throw new Error([e1?.message, e2?.message, e3?.message].join(' | '));

  const currentYear = years?.find((y) => y.is_current) ?? years?.[years.length - 1];
  if (!currentYear) throw new Error('No school year found - run `npx supabase db reset` first');
  if (!orgs?.length) throw new Error('No organizations found - run `npx supabase db reset` first');
  const collegeCodeById = new Map((colleges ?? []).map((c) => [c.id, c.code]));

  // -- 1. Accounts ---------------------------------------------------------
  const users: SeedUser[] = [
    { email: 'its.admin@acd.edu.ph', fullName: 'IT Super Admin', role: 'super_admin' },
    { email: 'osa.admin@acd.edu.ph', fullName: 'OSA Administrator', role: 'osa_admin' },
  ];

  // One dean / department head per college (step 2 of the approval chain).
  for (const college of colleges ?? []) {
    users.push({
      email: `dean.${college.code.toLowerCase()}@acd.edu.ph`,
      fullName: `Dean - ${college.name}`,
      role: 'dean',
      collegeId: college.id,
    });
  }

  for (const org of orgs) {
    users.push({
      email: `adviser.${org.code.toLowerCase()}@acd.edu.ph`,
      fullName: `Adviser - ${org.name}`,
      role: 'adviser',
      organizationId: org.id,
    });
    users.push({
      email: `president.${org.code.toLowerCase()}@acd.edu.ph`,
      fullName: `${org.name} President`,
      role: 'officer',
      organizationId: org.id,
      position: 'President',
    });
  }

  const ids = new Map<string, string>(); // email -> auth user id
  for (const user of users) {
    const id = await ensureUser(user);
    await ensureProfile(id, user);
    ids.set(user.email, id);
    process.stdout.write('.');
  }
  console.log(`\n${users.length} accounts ready`);

  // -- 2. Advisers + officers for the current school year -------------------
  for (const org of orgs) {
    const adviserId = ids.get(`adviser.${org.code.toLowerCase()}@acd.edu.ph`)!;
    const presidentId = ids.get(`president.${org.code.toLowerCase()}@acd.edu.ph`)!;

    const { error: ea } = await db.from('advisers').upsert(
      { profile_id: adviserId, organization_id: org.id, school_year_id: currentYear.id, is_active: true },
      { onConflict: 'organization_id,school_year_id' }
    );
    if (ea) throw new Error(`advisers(${org.code}): ${ea.message}`);

    const { error: eo } = await db.from('organization_officers').upsert(
      {
        organization_id: org.id,
        profile_id: presidentId,
        school_year_id: currentYear.id,
        position: 'President',
        is_active: true,
      },
      { onConflict: 'organization_id,school_year_id,position' }
    );
    if (eo) throw new Error(`officers(${org.code}): ${eo.message}`);

    // Deterministic membership figure so reports look plausible.
    await db.from('organizations').update({ membership_count: 20 + (org.code.length % 13) }).eq('id', org.id);
  }
  console.log('advisers + officers linked');

  // -- 3. Sample announcement (needs the OSA profile) ------------------------
  // Idempotent on its own so re-running the script heals a database that was
  // seeded before announcements existed.
  const osaId = ids.get('osa.admin@acd.edu.ph')!;
  const { data: existingAnnouncements } = await db.from('announcements').select('id').limit(1);
  if (!existingAnnouncements?.length) {
    const { error: ea } = await db.from('announcements').insert({
      title: 'OSA Advisory: Accreditation Requirements for 2026-2027',
      body:
        'All student organizations must submit their accreditation checklist items ' +
        'through SOMS on or before October 31, 2026. Upload your requirements under ' +
        'Organizations > Accreditation. Late submissions will be marked as conditional.',
      target_type: 'all',
      is_pinned: true,
      created_by: osaId,
    });
    if (ea) throw new Error(`announcement: ${ea.message}`);
    console.log('sample announcement inserted');
  }

  // -- 4. Sample submissions (only once) ------------------------------------
  const { data: existing } = await db.from('activity_proposals').select('id').limit(1);
  if (existing?.length) {
    console.log('Sample submissions already present - skipping (delete the rows to reseed).');
    await backfillApprovalInstances();
    return;
  }

  const osaName = 'OSA Administrator';
  const statuses: SubmissionStatus[] = [
    'draft', 'submitted', 'endorsed', 'under_review',
    'revision_requested', 'approved', 'rejected',
  ];
  const venues = ['Covered Court', 'Multipurpose Hall', 'AVR', 'Quadrangle', 'Gymnasium'];
  const approvedProposals: { id: string; organizationId: string; officerId: string; title: string }[] = [];

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const status = statuses[i % statuses.length];
    const officerId = ids.get(`president.${org.code.toLowerCase()}@acd.edu.ph`)!;
    const adviserId = ids.get(`adviser.${org.code.toLowerCase()}@acd.edu.ph`)!;
    const chain = STATUS_CHAIN[status];
    const day = 6 + (i % 20);

    const { data: proposal, error: ep } = await db
      .from('activity_proposals')
      .insert({
        organization_id: org.id,
        school_year_id: currentYear.id,
        created_by: officerId,
        title: `${org.name} ${['Leadership Seminar', 'Community Outreach', 'Career Workshop', 'Fun Run', 'Poster Making'][i % 5]} ${2026}`,
        description:
          'A student development activity organized by the officers of ' +
          org.name + ' in line with the school-year development plan.',
        objectives:
          '1. Build leadership skills among members\n2. Serve the wider ACD community\n3. Strengthen organization cohesion',
        activity_date: `2026-${String(10 + (i % 2)).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        venue: venues[i % venues.length],
        participants_count: 40 + ((i * 7) % 60),
        budget: 2500 + ((i * 500) % 8000),
        source_of_funds: i % 3 === 0 ? 'Organization funds' : 'Participant fees + organization funds',
        status,
        submitted_at: chain.length > 0 ? new Date().toISOString() : null,
        endorsed_at: isBefore(status, 'endorsed') ? new Date().toISOString() : null,
        reviewed_at: isBefore(status, 'under_review') ? new Date().toISOString() : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        reviewer_remarks:
          status === 'revision_requested'
            ? 'Please attach the detailed budget breakdown and re-upload.'
            : status === 'rejected'
              ? 'Activity falls outside the sanctioned calendar for this semester.'
              : status === 'approved'
                ? 'Approved. Proceed with the activity and submit the accomplishment report afterwards.'
                : null,
      })
      .select()
      .single();
    if (ep || !proposal) throw new Error(`proposal(${org.code}): ${ep?.message}`);

    // Review history for every step of the chain
    const steps = chain.length
      ? [...chain.map((s, idx) => (idx === 0 ? 'draft' : chain[idx - 1])), status]
      : [];
    for (let s = 1; s < steps.length; s++) {
      const from = steps[s - 1] as SubmissionStatus;
      const to = steps[s];
      const actorIsOfficer = s === 1 || to === 'draft';
      const deanId = ids.get(
        `dean.${(collegeCodeById.get(org.college_id) ?? '').toLowerCase()}@acd.edu.ph`
      );
      const actorId = actorIsOfficer
        ? officerId
        : to === 'endorsed'
          ? adviserId
          : to === 'under_review'
            ? deanId ?? osaId
            : osaId;
      const { data: actor } = await db.from('profiles').select('full_name, role').eq('id', actorId).single();
      const { error: el } = await db.from('review_logs').insert({
        record_type: 'activity_proposal',
        record_id: proposal.id,
        organization_id: org.id,
        from_status: from,
        to_status: to,
        action:
          to === 'submitted' ? (s === 1 ? 'submitted' : 'resubmitted')
          : to === 'endorsed' || to === 'under_review' ? 'step_approved'
          : to === 'approved' ? 'approved'
          : to === 'rejected' ? 'rejected'
          : to === 'revision_requested' ? 'revision_requested'
          : 'commented',
        remarks:
          to === 'endorsed' ? 'Endorsed - no objections from the adviser.'
          : to === 'under_review' ? 'Reviewed by the dean - no objections.'
          : to === 'approved' ? 'Approved by OSA.'
          : to === 'revision_requested' ? 'See reviewer remarks on the proposal.'
          : null,
        actor_id: actorId,
        actor_role: actor?.role ?? null,
        actor_name: actor?.full_name ?? null,
      });
      if (el) throw new Error(`review_logs(${org.code}): ${el.message}`);
    }

    // In-app notification for anything the officer is still waiting on
    if (status !== 'draft') {
      await db.from('notifications').insert({
        user_id: officerId,
        type: 'status_change',
        title: `Your proposal is now ${status}`,
        body: proposal.reviewer_remarks,
        link: `/proposals/${proposal.id}`,
        record_type: 'activity_proposal',
        record_id: proposal.id,
      });
    }

    // OSA records the paper copy for approved work
    if (status === 'approved') {
      await db.from('hardcopy_records').insert({
        record_type: 'activity_proposal',
        record_id: proposal.id,
        organization_id: org.id,
        reference_number: proposal.reference_number,
        received: true,
        received_at: new Date().toISOString(),
        received_by: osaId,
        receiver_name: osaName,
        remarks: 'Paper copy received together with the cover sheet.',
      });
      approvedProposals.push({
        id: proposal.id,
        organizationId: org.id,
        officerId,
        title: proposal.title,
      });
    }
  }
  console.log(`${orgs.length} sample proposals inserted`);

  // -- 5. Accomplishment reports / audit docs / other docs -------------------
  for (const p of approvedProposals.slice(0, 3)) {
    const { error } = await db.from('accomplishment_reports').insert({
      organization_id: p.organizationId,
      school_year_id: currentYear.id,
      proposal_id: p.id,
      created_by: p.officerId,
      title: `Accomplishment Report - ${p.title}`,
      summary: 'Activity completed as proposed; all objectives were met.',
      outcomes: 'Higher member participation and positive feedback from participants.',
      attendance_count: 55,
      budget_spent: 4200,
      liquidation_summary: 'Receipts and liquidation form attached for review.',
      status: 'approved',
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      reviewer_remarks: 'Report accepted. Liquidation is complete.',
    });
    if (error) throw new Error(`report: ${error.message}`);
  }

  for (let i = 0; i < 3; i++) {
    const org = orgs[i];
    const officerId = ids.get(`president.${org.code.toLowerCase()}@acd.edu.ph`)!;
    const { error } = await db.from('audit_documents').insert({
      organization_id: org.id,
      school_year_id: currentYear.id,
      created_by: officerId,
      doc_type: i === 0 ? 'financial_statement' : i === 1 ? 'receipt' : 'audit_report',
      semester: 'first',
      title: `${org.name} ${['Financial Statement', 'Official Receipts', 'Internal Audit Report'][i]}`,
      description: 'Submitted for the first-semester audit of the organization.',
      status: i === 0 ? 'approved' : i === 1 ? 'submitted' : 'under_review',
      submitted_at: new Date().toISOString(),
    });
    if (error) throw new Error(`audit doc: ${error.message}`);
  }

  for (let i = 0; i < 2; i++) {
    const org = orgs[i];
    const officerId = ids.get(`president.${org.code.toLowerCase()}@acd.edu.ph`)!;
    const { error } = await db.from('other_documents').insert({
      organization_id: org.id,
      school_year_id: currentYear.id,
      created_by: officerId,
      category: i === 0 ? 'constitution_by_laws' : 'resolution',
      title: i === 0 ? `${org.name} Constitution and By-Laws` : `Board Resolution No. ${i + 1} - ${org.name}`,
      description: 'General document filed with the Office of Student Affairs.',
      status: 'approved',
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    });
    if (error) throw new Error(`other doc: ${error.message}`);
  }

  // -- 6. Requirements with due dates ---------------------------------------
  const osa = { assigned_by: osaId };
  for (let i = 0; i < 4; i++) {
    const org = orgs[i];
    const { error } = await db.from('requirements').insert({
      organization_id: org.id,
      school_year_id: currentYear.id,
      ...osa,
      title: ['Submit liquidation report', 'Renew accreditation form', 'File minutes of meetings', 'Turn over treasury records'][i],
      description: 'Created by OSA for the current school year.',
      due_date: `2026-${String(11 + (i % 2)).padStart(2, '0')}-${String(10 + i * 5).padStart(2, '0')}`,
      status: i === 3 ? 'completed' : 'open',
      completed_at: i === 3 ? new Date().toISOString() : null,
    });
    if (error) throw new Error(`requirement: ${error.message}`);
  }

  // -- 7. A real file in private storage (proves the storage policies) ------
  const target = approvedProposals[0];
  if (target) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const storagePath = `${target.organizationId}/proposals/${target.id}/evidence.png`;
    const { error: eu } = await db.storage
      .from('submissions')
      .upload(storagePath, png, { contentType: 'image/png', upsert: false });
    if (eu && !/already exists/i.test(eu.message)) throw new Error(`upload: ${eu.message}`);

    const { error: ed } = await db.from('documents').insert({
      bucket: 'submissions',
      storage_path: storagePath,
      file_name: 'evidence.png',
      mime_type: 'image/png',
      size_bytes: png.length,
      doc_type: 'proposal',
      record_type: 'activity_proposal',
      record_id: target.id,
      organization_id: target.organizationId,
      uploaded_by: target.officerId,
    });
    if (ed) throw new Error(`document row: ${ed.message}`);
    console.log('placeholder attachment uploaded');
  }

  // -- 8. Approval chain instances for every submission ---------------------
  await backfillApprovalInstances();

  // -- Summary ---------------------------------------------------------------
  await sleep(100);
  console.log('\n================ SEEDED ACCOUNTS ================');
  console.log(`Default password for all accounts: ${password}`);
  console.log('-------------------------------------------------');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(11)} ${u.email}`);
  }
  console.log('=================================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
