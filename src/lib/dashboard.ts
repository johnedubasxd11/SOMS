import 'server-only';

import type { Profile } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import {
  REQUIREMENT_LABELS,
  REQUIREMENT_TONE,
  STATUS_LABELS,
  STATUS_TONE,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from '@/lib/labels';
import {
  SUBMISSION_MODULES,
  moduleForRecordType,
  type ModuleKey,
  type SubmissionModule,
} from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 6 - role-aware dashboard data.
 *
 * Every count, queue and list on /dashboard is assembled here so the page
 * stays a pure renderer. All queries run through the caller's own session,
 * so Postgres RLS decides what each role may see - an officer's "all records"
 * is their organization's records, OSA's is everything.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DashboardAudience = 'osa' | 'adviser' | 'dean' | 'officer';

export interface DashboardKpi {
  label: string;
  /** Pre-formatted ("18", "₱1,234.00") - the page only renders it. */
  value: string;
  hint: string;
  tone: 'default' | 'warning' | 'danger';
}

export interface DashboardItem {
  href: string;
  title: string;
  meta: string;
  badge: string;
  /** Tailwind tone classes from STATUS_TONE / REQUIREMENT_TONE. */
  badgeClass: string;
}

export interface DashboardSection {
  title: string;
  description: string;
  emptyMessage: string;
  items: DashboardItem[];
}

export interface DashboardMatrix {
  statuses: SubmissionStatus[];
  modules: { key: ModuleKey; label: string; basePath: string }[];
  /** counts[statusIndex][moduleIndex] */
  counts: number[][];
  /** Per-module totals (last row of the table). */
  totals: number[];
  grandTotal: number;
}

export interface DashboardData {
  audience: DashboardAudience;
  schoolYearName: string | null;
  kpis: DashboardKpi[];
  attention: DashboardSection;
  matrix: DashboardMatrix;
  recent: DashboardSection;
}

/** Short column headers for the matrix (listLabel is too wide). */
const MATRIX_LABELS: Record<ModuleKey, string> = {
  proposals: 'Proposals',
  reports: 'Reports',
  audit: 'Audit Docs',
  documents: 'Other Docs',
};

const MODULES = Object.values(SUBMISSION_MODULES);

function audienceOf(profile: Profile): DashboardAudience {
  if (profile.role === 'osa_admin' || profile.role === 'super_admin') return 'osa';
  if (profile.role === 'dean') return 'dean';
  if (profile.role === 'adviser') return 'adviser';
  return 'officer';
}

/**
 * Which organizations this profile's numbers should be scoped to.
 * `null` means "no extra filter" (OSA sees everything RLS allows);
 * an array narrows the queries - an empty array means "nothing to show".
 */
async function scopeOrgIds(
  supabase: Supabase,
  profile: Profile,
  schoolYearId: string | null
): Promise<string[] | null> {
  if (profile.role === 'osa_admin' || profile.role === 'super_admin') return null;
  // Deans have no org list of their own: RLS already limits them to the
  // organizations of their college, so no extra filter is needed.
  if (profile.role === 'dean') return null;
  if (profile.role === 'officer') {
    return profile.organization_id ? [profile.organization_id] : [];
  }
  // Adviser: the organizations assigned to them (per school year).
  let builder = supabase
    .from('advisers')
    .select('organization_id')
    .eq('profile_id', profile.id)
    .eq('is_active', true);
  if (schoolYearId) builder = builder.eq('school_year_id', schoolYearId);
  const { data, error } = await builder;
  if (error) throw new Error(`Failed to load adviser assignments: ${error.message}`);
  return (data ?? []).map((row) => row.organization_id);
}

/**
 * Status counts for one submission table.
 *
 * `created_by` is selected as well so an officer's "mine" numbers can be
 * derived from the same round trip instead of a second query per module.
 */
async function statusRows(
  supabase: Supabase,
  table: SubmissionModule['table'],
  filters: { schoolYearId: string | null; orgIds: string[] | null }
): Promise<{ status: SubmissionStatus; created_by: string | null }[]> {
  if (filters.orgIds && filters.orgIds.length === 0) return [];
  let builder = supabase.from(table).select('status, created_by');
  if (filters.schoolYearId) builder = builder.eq('school_year_id', filters.schoolYearId);
  if (filters.orgIds) builder = builder.in('organization_id', filters.orgIds);
  const { data, error } = await builder;
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return data ?? [];
}

interface ModuleRecord {
  module: SubmissionModule;
  id: string;
  reference_number: string | null;
  title: string;
  status: SubmissionStatus;
  organization_name: string | null;
  created_at: string;
  submitted_at: string | null;
}

/**
 * Latest records across all four modules, merged into one ordered list.
 * Used by "Needs your attention" (filtered by status) and "Recent activity".
 */
async function collectRecords(
  supabase: Supabase,
  filters: {
    schoolYearId: string | null;
    orgIds: string[] | null;
    statuses?: SubmissionStatus[];
    createdBy?: string;
  },
  order: 'recent' | 'queue',
  perModule: number
): Promise<ModuleRecord[]> {
  if (filters.orgIds && filters.orgIds.length === 0) return [];

  const batches = await Promise.all(
    MODULES.map(async (module) => {
      let builder = supabase
        .from(module.view)
        .select(
          'id, reference_number, title, status, organization_name, created_at, submitted_at'
        )
        .limit(perModule);
      if (filters.schoolYearId) builder = builder.eq('school_year_id', filters.schoolYearId);
      if (filters.orgIds) builder = builder.in('organization_id', filters.orgIds);
      if (filters.statuses) builder = builder.in('status', filters.statuses);
      if (filters.createdBy) builder = builder.eq('created_by', filters.createdBy);
      builder =
        order === 'queue'
          ? // Oldest waiting first, like the /osa/reviews queue.
            builder.order('submitted_at', { ascending: true, nullsFirst: false })
          : builder.order('created_at', { ascending: false });
      const { data, error } = await builder;
      if (error) throw new Error(`Failed to load ${module.view}: ${error.message}`);
      return (data ?? []).map((row) => ({ module, ...row })) as ModuleRecord[];
    })
  );

  const merged = batches.flat();
  if (order === 'queue') {
    merged.sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));
  } else {
    merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return merged;
}

function recordItem(record: ModuleRecord, href?: string): DashboardItem {
  return {
    href: href ?? `${record.module.basePath}/${record.id}`,
    title: record.title,
    meta: `${record.module.label} · ${record.reference_number ?? 'No reference'} · ${
      record.organization_name ?? 'Unknown organization'
    }`,
    badge: STATUS_LABELS[record.status],
    badgeClass: STATUS_TONE[record.status],
  };
}

interface RequirementDigest {
  open: number;
  overdue: number;
  total: number;
}

/**
 * Requirement counters. `overdue` includes open rows whose due date has
 * already passed, so the dashboard is correct even before the daily sweep
 * (sweep_requirements) has stamped them.
 */
async function requirementDigest(
  supabase: Supabase,
  filters: { schoolYearId: string | null; orgIds: string[] | null }
): Promise<RequirementDigest> {
  if (filters.orgIds && filters.orgIds.length === 0) return { open: 0, overdue: 0, total: 0 };
  let builder = supabase.from('requirements').select('id, status, due_date');
  if (filters.schoolYearId) builder = builder.eq('school_year_id', filters.schoolYearId);
  if (filters.orgIds) builder = builder.in('organization_id', filters.orgIds);
  const { data, error } = await builder;
  if (error) throw new Error(`Failed to load requirements: ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  let open = 0;
  let overdue = 0;
  for (const row of data ?? []) {
    const pastDue = !!row.due_date && row.due_date < today;
    if (row.status === 'overdue' || (row.status === 'open' && pastDue)) overdue += 1;
    else if (row.status === 'open') open += 1;
  }
  return { open, overdue, total: (data ?? []).length };
}

/** Approved records whose paper copy OSA has not logged yet (all modules). */
async function awaitingHardcopy(
  supabase: Supabase,
  filters: { schoolYearId: string | null; orgIds: string[] | null }
): Promise<number> {
  if (filters.orgIds && filters.orgIds.length === 0) return 0;
  const batches = await Promise.all(
    MODULES.map(async (module) => {
      let builder = supabase
        .from(module.view)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('hardcopy_received', false);
      if (filters.schoolYearId) builder = builder.eq('school_year_id', filters.schoolYearId);
      if (filters.orgIds) builder = builder.in('organization_id', filters.orgIds);
      const { count, error } = await builder;
      if (error) throw new Error(`Failed to count hardcopies: ${error.message}`);
      return count ?? 0;
    })
  );
  return batches.reduce((sum, count) => sum + count, 0);
}

type PendingStepRow = {
  record_id: string | null;
  record_type: string | null;
  title: string | null;
  organization_name: string | null;
  reference_number: string | null;
  submission_status: SubmissionStatus | null;
  submitted_at: string | null;
};

/** How many records currently rest on the given approval step (RLS scoped). */
async function countPendingAtStep(
  supabase: Supabase,
  stepRole: 'adviser' | 'dean' | 'osa_admin'
): Promise<number> {
  const { count, error } = await supabase
    .from('v_pending_approval')
    .select('record_id', { count: 'exact', head: true })
    .eq('step_role', stepRole);
  if (error) throw new Error(`Failed to count pending approvals: ${error.message}`);
  return count ?? 0;
}

/** Oldest records resting on the given approval step, for attention lists. */
async function pendingAtStep(
  supabase: Supabase,
  stepRole: 'adviser' | 'dean' | 'osa_admin',
  limit: number
): Promise<PendingStepRow[]> {
  const { data, error } = await supabase
    .from('v_pending_approval')
    .select(
      'record_id, record_type, title, organization_name, reference_number, submission_status, submitted_at'
    )
    .eq('step_role', stepRole)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load pending approvals: ${error.message}`);
  return data ?? [];
}

function pendingItem(row: PendingStepRow): DashboardItem {
  const mod = moduleForRecordType(row.record_type);
  const status = row.submission_status ?? 'submitted';
  return {
    href: mod && row.record_id ? `${mod.basePath}/${row.record_id}` : '/reviews',
    title: row.title ?? 'Untitled',
    meta: `${mod?.label ?? 'Submission'} · ${
      row.reference_number ?? 'No reference'
    } · ${row.organization_name ?? 'Unknown organization'}`,
    badge: STATUS_LABELS[status],
    badgeClass: STATUS_TONE[status],
  };
}

function buildMatrix(moduleRows: { status: SubmissionStatus; created_by: string | null }[][]) {
  const statuses = SUBMISSION_STATUSES;
  const counts = statuses.map(() => MODULES.map(() => 0));
  const totals = MODULES.map(() => 0);

  moduleRows.forEach((rows, moduleIndex) => {
    for (const row of rows) {
      const statusIndex = statuses.indexOf(row.status);
      if (statusIndex === -1) continue;
      counts[statusIndex][moduleIndex] += 1;
      totals[moduleIndex] += 1;
    }
  });

  return {
    statuses,
    modules: MODULES.map((module) => ({
      key: module.key as ModuleKey,
      label: MATRIX_LABELS[module.key as ModuleKey],
      basePath: module.basePath,
    })),
    counts,
    totals,
    grandTotal: totals.reduce((sum, count) => sum + count, 0),
  };
}

export async function loadDashboard(
  profile: Profile,
  supabase: Supabase
): Promise<DashboardData> {
  const audience = audienceOf(profile);

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle();
  const schoolYearId = schoolYear?.id ?? null;
  const yearHint = schoolYear ? `School year ${schoolYear.name}` : 'All school years';

  const orgIds = await scopeOrgIds(supabase, profile, schoolYearId);

  const [moduleRows, requirements, recent] = await Promise.all([
    Promise.all(
      MODULES.map((module) =>
        statusRows(supabase, module.table, { schoolYearId, orgIds })
      )
    ),
    requirementDigest(supabase, { schoolYearId, orgIds }),
    collectRecords(supabase, { schoolYearId, orgIds }, 'recent', 3),
  ]);

  const matrix = buildMatrix(moduleRows);
  const byStatus = (statuses: SubmissionStatus[], rows = moduleRows.flat()) => {
    const wanted = new Set<string>(statuses);
    return rows.filter((row) => wanted.has(row.status)).length;
  };

  const kpis: DashboardKpi[] = [];
  let attention: DashboardSection;
  const filtered = orgIds !== null;

  if (audience === 'osa') {
    const [orgCount, budgetRows, hardcopy, awaitingOsa, queueRows] =
      await Promise.all([
        supabase
          .from('organizations')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        schoolYearId
          ? supabase.from('v_organization_summary').select('approved_budget').eq('school_year_id', schoolYearId)
          : Promise.resolve({ data: [] as { approved_budget: number | null }[] }),
        awaitingHardcopy(supabase, { schoolYearId, orgIds }),
        countPendingAtStep(supabase, 'osa_admin'),
        pendingAtStep(supabase, 'osa_admin', 6),
      ]);

    const awaitingDecision = awaitingOsa;
    const approvedBudget = (budgetRows.data ?? []).reduce(
      (sum, row) => sum + Number(row.approved_budget ?? 0),
      0
    );

    kpis.push(
      {
        label: 'Active organizations',
        value: String(orgCount.count ?? 0),
        hint: 'Across all colleges',
        tone: 'default',
      },
      {
        label: 'Awaiting decision',
        value: String(awaitingDecision),
        hint: 'At the OSA approval step',
        tone: awaitingDecision > 0 ? 'warning' : 'default',
      },
      {
        label: 'Overdue requirements',
        value: String(requirements.overdue),
        hint: 'Past their due date',
        tone: requirements.overdue > 0 ? 'danger' : 'default',
      },
      {
        label: 'Approved budget',
        value: formatMoney(approvedBudget),
        hint: `${yearHint} · approved proposals`,
        tone: 'default',
      }
    );

    const items = queueRows.map(pendingItem);
    if (hardcopy > 0) {
      items.push({
        href: '/osa/hardcopy',
        title: `${hardcopy} approved record${hardcopy === 1 ? '' : 's'} still awaiting the paper copy`,
        meta: 'Hardcopy tracking',
        badge: 'Action needed',
        badgeClass: 'bg-amber-500/15 text-amber-700',
      });
    }
    if (requirements.overdue > 0) {
      items.push({
        href: '/requirements?status=overdue',
        title: `${requirements.overdue} requirement${requirements.overdue === 1 ? '' : 's'} past their deadline`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.overdue,
        badgeClass: REQUIREMENT_TONE.overdue,
      });
    }
    attention = {
      title: 'Waiting for your decision',
      description: 'The oldest submissions first, then paperwork that needs a nudge.',
      emptyMessage: 'Nothing is waiting for OSA right now.',
      items,
    };
  } else if (audience === 'adviser') {
    const [awaitingEndorsement, withDean, withOsa, queueRows] = await Promise.all([
      countPendingAtStep(supabase, 'adviser'),
      countPendingAtStep(supabase, 'dean'),
      countPendingAtStep(supabase, 'osa_admin'),
      pendingAtStep(supabase, 'adviser', 6),
    ]);

    const inReview = withDean + withOsa;

    kpis.push(
      {
        label: 'Organizations advised',
        value: String((orgIds ?? []).length),
        hint: yearHint,
        tone: 'default',
      },
      {
        label: 'Awaiting my endorsement',
        value: String(awaitingEndorsement),
        hint: 'At the adviser step in my organizations',
        tone: awaitingEndorsement > 0 ? 'warning' : 'default',
      },
      {
        label: 'With dean & OSA',
        value: String(inReview),
        hint: 'Endorsed, under review or before OSA',
        tone: 'default',
      },
      {
        label: 'Overdue requirements',
        value: String(requirements.overdue),
        hint: 'Past their due date',
        tone: requirements.overdue > 0 ? 'danger' : 'default',
      }
    );

    const items = queueRows.map(pendingItem);
    if (requirements.overdue > 0) {
      items.push({
        href: '/requirements?status=overdue',
        title: `${requirements.overdue} requirement${requirements.overdue === 1 ? '' : 's'} past their deadline`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.overdue,
        badgeClass: REQUIREMENT_TONE.overdue,
      });
    } else if (requirements.open > 0) {
      items.push({
        href: '/requirements?status=open',
        title: `${requirements.open} open requirement${requirements.open === 1 ? '' : 's'}`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.open,
        badgeClass: REQUIREMENT_TONE.open,
      });
    }
    attention = {
      title: 'Waiting for your endorsement',
      description: 'Records submitted by the organizations in your charge.',
      emptyMessage: 'No record is waiting for your endorsement.',
      items,
    };
  } else if (audience === 'dean') {
    const [orgCount, awaitingApproval, awaitingAdviser, queueRows] =
      await Promise.all([
        supabase
          .from('organizations')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        countPendingAtStep(supabase, 'dean'),
        countPendingAtStep(supabase, 'adviser'),
        pendingAtStep(supabase, 'dean', 6),
      ]);

    kpis.push(
      {
        label: 'Organizations in my college',
        value: String(orgCount.count ?? 0),
        hint: yearHint,
        tone: 'default',
      },
      {
        label: 'Awaiting my approval',
        value: String(awaitingApproval),
        hint: 'Endorsed by the adviser',
        tone: awaitingApproval > 0 ? 'warning' : 'default',
      },
      {
        label: 'With the adviser',
        value: String(awaitingAdviser),
        hint: 'Waiting for endorsement',
        tone: 'default',
      },
      {
        label: 'Overdue requirements',
        value: String(requirements.overdue),
        hint: 'Past their due date',
        tone: requirements.overdue > 0 ? 'danger' : 'default',
      }
    );

    const items = queueRows.map(pendingItem);
    if (requirements.overdue > 0) {
      items.push({
        href: '/requirements?status=overdue',
        title: `${requirements.overdue} requirement${requirements.overdue === 1 ? '' : 's'} past their deadline`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.overdue,
        badgeClass: REQUIREMENT_TONE.overdue,
      });
    } else if (requirements.open > 0) {
      items.push({
        href: '/requirements?status=open',
        title: `${requirements.open} open requirement${requirements.open === 1 ? '' : 's'}`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.open,
        badgeClass: REQUIREMENT_TONE.open,
      });
    }
    attention = {
      title: 'Waiting for your approval',
      description: 'Endorsed submissions from the colleges you head.',
      emptyMessage: 'No submission is waiting for your approval.',
      items,
    };
  } else {
    const mineRows = moduleRows.flat().filter((row) => row.created_by === profile.id);
    const myCount = mineRows.length;
    const myAction = mineRows.filter(
      (row) => row.status === 'draft' || row.status === 'revision_requested'
    ).length;
    const inFlight = byStatus(['submitted', 'endorsed', 'under_review']);

    // Two targeted batches so a pile of new drafts can never push a
    // requested revision out of the queue (each status gets its own limit).
    const [revisions, drafts] = await Promise.all([
      collectRecords(
        supabase,
        { schoolYearId, orgIds, statuses: ['revision_requested'], createdBy: profile.id },
        'queue',
        2
      ),
      collectRecords(
        supabase,
        { schoolYearId, orgIds, statuses: ['draft'], createdBy: profile.id },
        'recent',
        2
      ),
    ]);
    const orgCount = (orgIds ?? []).length;

    kpis.push(
      {
        label: 'My submissions',
        value: String(myCount),
        hint: yearHint,
        tone: 'default',
      },
      {
        label: 'Awaiting my action',
        value: String(myAction),
        hint: 'Drafts and requested revisions',
        tone: myAction > 0 ? 'warning' : 'default',
      },
      {
        label: 'With adviser & OSA',
        value: String(inFlight),
        hint: 'Submitted, endorsed or under review',
        tone: 'default',
      },
      {
        label: 'Requirements',
        value: String(requirements.open + requirements.overdue),
        hint: orgCount === 0 ? 'No organization assigned' : 'Open or overdue',
        tone: requirements.overdue > 0 ? 'danger' : requirements.open > 0 ? 'warning' : 'default',
      }
    );

    // Revisions first (they block the workflow), then drafts.
    const items = [
      ...revisions
        .slice(0, 3)
        .map((record) => recordItem(record, `${record.module.basePath}/${record.id}/edit`)),
      ...drafts.slice(0, 2).map((record) => recordItem(record)),
    ];
    if (requirements.overdue > 0) {
      items.push({
        href: '/requirements?status=overdue',
        title: `${requirements.overdue} requirement${requirements.overdue === 1 ? '' : 's'} past their deadline`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.overdue,
        badgeClass: REQUIREMENT_TONE.overdue,
      });
    } else if (requirements.open > 0) {
      items.push({
        href: '/requirements?status=open',
        title: `${requirements.open} open requirement${requirements.open === 1 ? '' : 's'} for the organization`,
        meta: 'Requirements',
        badge: REQUIREMENT_LABELS.open,
        badgeClass: REQUIREMENT_TONE.open,
      });
    }
    attention = {
      title: 'Your work in progress',
      description: 'Records only you can move forward, plus upcoming deadlines.',
      emptyMessage: 'Nothing needs your attention - start a new submission.',
      items,
    };
  }

  return {
    audience,
    schoolYearName: schoolYear?.name ?? null,
    kpis,
    attention,
    matrix,
    recent: {
      title: 'Recent activity',
      description: filtered
        ? 'The latest submissions from your scope.'
        : audience === 'dean'
          ? 'The latest submissions from your college.'
          : 'The latest submissions across every organization.',
      emptyMessage: 'No submissions yet.',
      items: recent.slice(0, 6).map((record) => recordItem(record)),
    },
  };
}
