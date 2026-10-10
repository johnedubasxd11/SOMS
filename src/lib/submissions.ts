import type { Database } from '@/lib/database.types';

import type { Profile } from '@/lib/auth';
import type { SubmissionStatus } from '@/lib/labels';

export type RecordType = Database['public']['Enums']['record_type'];
export type UserRole = Database['public']['Enums']['user_role'];

/**
 * One entry per workflow module (Phase 3 proposals, Phase 4 reports and other
 * documents, Phase 5 audit documents). Every module shares the same tables
 * shape, the same `transition_submission()` RPC and the same RLS rules - only
 * the fields, the route and the storage folder differ.
 */
export interface SubmissionModule {
  key: string;
  recordType: RecordType;
  table: 'activity_proposals' | 'accomplishment_reports' | 'other_documents' | 'audit_documents';
  view:
    | 'v_activity_proposal_list'
    | 'v_accomplishment_report_list'
    | 'v_other_document_list'
    | 'v_audit_document_list';
  /** Route prefix, e.g. `/proposals`. */
  basePath: string;
  /** "Activity proposal" - used in copy and titles. */
  label: string;
  /** "Activity Proposals" - sidebar + page title. */
  listLabel: string;
  /** "proposal" - lower-case noun used in buttons, counts and empty states. */
  noun: string;
  /** Folder inside the `submissions` bucket: {org}/{storageModule}/{record}/… */
  storageModule: 'proposals' | 'reports' | 'audit' | 'other';
  /** `documents.doc_type` for the attachments of this module. */
  docType: Database['public']['Enums']['document_kind'];
  /** Roles that may create a record (everyone else can only review it). */
  createRoles: UserRole[];
}

export const SUBMISSION_MODULES = {
  proposals: {
    key: 'proposals',
    recordType: 'activity_proposal',
    table: 'activity_proposals',
    view: 'v_activity_proposal_list',
    basePath: '/proposals',
    label: 'Activity proposal',
    listLabel: 'Activity Proposals',
    noun: 'proposal',
    storageModule: 'proposals',
    docType: 'proposal',
    createRoles: ['officer'],
  },
  reports: {
    key: 'reports',
    recordType: 'accomplishment_report',
    table: 'accomplishment_reports',
    view: 'v_accomplishment_report_list',
    basePath: '/reports',
    label: 'Accomplishment report',
    listLabel: 'Accomplishment Reports',
    noun: 'report',
    storageModule: 'reports',
    docType: 'report',
    createRoles: ['officer'],
  },
  documents: {
    key: 'documents',
    recordType: 'other_document',
    table: 'other_documents',
    view: 'v_other_document_list',
    basePath: '/documents',
    label: 'Other document',
    listLabel: 'Other Documents',
    noun: 'document',
    storageModule: 'other',
    docType: 'other',
    createRoles: ['officer'],
  },
  audit: {
    key: 'audit',
    recordType: 'audit_document',
    table: 'audit_documents',
    view: 'v_audit_document_list',
    basePath: '/audit-documents',
    label: 'Audit document',
    listLabel: 'Audit Documents',
    noun: 'audit document',
    storageModule: 'audit',
    docType: 'audit',
    createRoles: ['officer'],
  },
} as const satisfies Record<string, SubmissionModule>;

export type ModuleKey = keyof typeof SUBMISSION_MODULES;

const BY_KEY: Record<string, SubmissionModule> = SUBMISSION_MODULES;
const BY_RECORD_TYPE: Record<string, SubmissionModule> = Object.values(
  SUBMISSION_MODULES
).reduce<Record<string, SubmissionModule>>((acc, module) => {
  acc[module.recordType] = module;
  return acc;
}, {});

export function getModule(key: string | null | undefined): SubmissionModule | null {
  if (!key) return null;
  return BY_KEY[key] ?? null;
}

export function moduleForRecordType(recordType: string | null | undefined): SubmissionModule | null {
  if (!recordType) return null;
  return BY_RECORD_TYPE[recordType] ?? null;
}

const EDITABLE: SubmissionStatus[] = ['draft', 'revision_requested'];
const DECIDABLE: SubmissionStatus[] = ['submitted', 'endorsed', 'under_review'];

export type ApprovalStepRole = Database['public']['Enums']['approval_step_role'];

export interface SubmissionRecord {
  status: SubmissionStatus;
  organization_id: string | null;
  created_by: string | null;
}

/** The current (lowest-numbered pending) step of the record's chain. */
export interface PendingStep {
  step_number: number;
  step_role: ApprovalStepRole;
}

export interface SubmissionPermissions {
  /** Edit the fields (creator officer / OSA, while still editable). */
  canEdit: boolean;
  /** draft | revision_requested -> submitted */
  canSubmit: boolean;
  /** submitted -> draft */
  canWithdraw: boolean;
  /** OSA: submitted | endorsed -> under_review (single-step chains). */
  canStartReview: boolean;
  /**
   * You own the pending approval step: approve (adviser: endorse), request a
   * revision, or reject. Re-checked server-side by transition_submission().
   */
  canDecide: boolean;
  /** adviser, dean or OSA: leave a remark without changing the status */
  canComment: boolean;
  /** officer of that organization (editable status) or OSA: attach files */
  canAttach: boolean;
  /** Role of the pending step - drives button labels ("Endorse" vs "Approve"). */
  currentStepRole: ApprovalStepRole | null;
}

/**
 * Pure permission matrix for the workflow UI. It only decides what the screen
 * offers - every action is re-checked in Postgres by RLS and by
 * transition_submission(), which is the real authority.
 */
export function submissionPermissions(
  profile: Profile,
  record: SubmissionRecord,
  {
    isAdviser,
    pendingStep,
    collegeId,
  }: {
    isAdviser: boolean;
    pendingStep: PendingStep | null;
    collegeId: string | null;
  }
): SubmissionPermissions {
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const isOfficerOfOrg =
    profile.role === 'officer' &&
    !!profile.organization_id &&
    profile.organization_id === record.organization_id;
  const isDeanOfOrg =
    profile.role === 'dean' &&
    !!profile.college_id &&
    !!collegeId &&
    profile.college_id === collegeId;

  const ownsStep =
    pendingStep?.step_role === 'adviser'
      ? isAdviser
      : pendingStep?.step_role === 'dean'
        ? isDeanOfOrg
        : pendingStep?.step_role === 'osa_admin'
          ? isOsa
          : false;

  const editable = EDITABLE.includes(record.status);

  return {
    canEdit: editable && (isOsa || (isOfficerOfOrg && profile.id === record.created_by)),
    canSubmit: isOfficerOfOrg && editable,
    canWithdraw: isOfficerOfOrg && record.status === 'submitted',
    canStartReview:
      isOsa &&
      pendingStep?.step_role === 'osa_admin' &&
      ['submitted', 'endorsed'].includes(record.status),
    canDecide: ownsStep && DECIDABLE.includes(record.status),
    canComment: isOsa || isAdviser || isDeanOfOrg,
    canAttach: isOsa || (isOfficerOfOrg && editable),
    currentStepRole: pendingStep?.step_role ?? null,
  };
}
