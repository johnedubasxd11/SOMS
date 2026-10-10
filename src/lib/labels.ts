import type { Database } from '@/lib/database.types';

import type { UserRole } from '@/lib/navigation';

export type { UserRole };

export type SubmissionStatus = Database['public']['Enums']['submission_status'];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  osa_admin: 'OSA Admin',
  dean: 'Dean',
  adviser: 'Adviser',
  officer: 'Officer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin:
    'Manages user accounts, roles, school years, and system settings.',
  osa_admin:
    'Endorses and approves proposals, manages organizations, reviews reports.',
  dean: 'Approves submissions from the colleges they head, before OSA.',
  adviser: 'Reviews and endorses submissions for their organization.',
  officer:
    'Prepares proposals, reports, and documents for their organization.',
};

export function roleBadgeVariant(
  role: UserRole
): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'super_admin':
      return 'default';
    case 'osa_admin':
      return 'secondary';
    case 'dean':
      return 'outline';
    default:
      return 'outline';
  }
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  endorsed: 'Endorsed',
  under_review: 'Under Review',
  revision_requested: 'Revision Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Canonical workflow order - used by filters, badges and the detail page. */
export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  'draft',
  'submitted',
  'endorsed',
  'under_review',
  'revision_requested',
  'approved',
  'rejected',
];

/** Statuses that still sit in an approval queue (waiting for a step owner). */
export const QUEUE_STATUSES: SubmissionStatus[] = [
  'submitted',
  'endorsed',
  'under_review',
];

export type ReviewAction = Database['public']['Enums']['review_action'];

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  created: 'Created',
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  withdrawn: 'Withdrawn',
  endorsed: 'Endorsed',
  commented: 'Commented',
  started_review: 'Started review',
  revision_requested: 'Revision requested',
  approved: 'Approved',
  rejected: 'Rejected',
  hardcopy_received: 'Hardcopy received',
  step_approved: 'Step approved',
};

export type ApprovalStepRole =
  Database['public']['Enums']['approval_step_role'];

export type ApprovalStepStatus =
  Database['public']['Enums']['approval_step_status'];

export const APPROVAL_STEP_ROLE_LABELS: Record<ApprovalStepRole, string> = {
  adviser: 'Adviser',
  dean: 'Dean',
  osa_admin: 'OSA',
};

export const APPROVAL_STEP_STATUS_LABELS: Record<
  ApprovalStepStatus,
  string
> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision requested',
  cancelled: 'Cancelled',
};

/** Ordered labels for a chain summary, e.g. "Adviser → Dean → OSA". */
export const APPROVAL_STEP_ROLE_SEQUENCE = (roles: ApprovalStepRole[]) =>
  roles.map((role) => APPROVAL_STEP_ROLE_LABELS[role]).join(' → ');

/** Colour tones used by every status badge in the app. */
export const STATUS_TONE: Record<SubmissionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-500/15 text-blue-700',
  endorsed: 'bg-violet-500/15 text-violet-700',
  under_review: 'bg-amber-500/15 text-amber-700',
  revision_requested: 'bg-orange-500/15 text-orange-700',
  approved: 'bg-emerald-500/15 text-emerald-700',
  rejected: 'bg-destructive/15 text-destructive',
};

export type CopyStatus = Database['public']['Enums']['copy_status'];

/** softcopy only / paper copy logged / approved AND paper copy in. */
export const COPY_STATUS_LABELS: Record<CopyStatus, string> = {
  softcopy_only: 'Softcopy only',
  hardcopy_received: 'Hardcopy received',
  complete: 'Complete',
};

export const COPY_STATUS_TONE: Record<CopyStatus, string> = {
  softcopy_only: 'bg-muted text-muted-foreground',
  hardcopy_received: 'bg-amber-500/15 text-amber-700',
  complete: 'bg-emerald-500/15 text-emerald-700',
};

export const COPY_STATUS_VALUES: CopyStatus[] = [
  'softcopy_only',
  'hardcopy_received',
  'complete',
];

export type NotificationType = Database['public']['Enums']['notification_type'];

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  status_change: 'Status change',
  comment: 'Comment',
  requirement: 'Requirement',
  reminder: 'Reminder',
  system: 'System',
};

export type RequirementStatus = Database['public']['Enums']['requirement_status'];

export const REQUIREMENT_LABELS: Record<RequirementStatus, string> = {
  open: 'Open',
  completed: 'Completed',
  overdue: 'Overdue',
  waived: 'Waived',
};

export const REQUIREMENT_TONE: Record<RequirementStatus, string> = {
  open: 'bg-blue-500/15 text-blue-700',
  completed: 'bg-emerald-500/15 text-emerald-700',
  overdue: 'bg-destructive/15 text-destructive',
  waived: 'bg-muted text-muted-foreground',
};

export const REQUIREMENT_VALUES: RequirementStatus[] = [
  'open',
  'completed',
  'overdue',
  'waived',
];
