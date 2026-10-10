import { formatDate } from '@/lib/format';
import { APPROVAL_STEP_ROLE_LABELS, type ApprovalStepRole } from '@/lib/labels';
import { cn } from 'cn';

export type ApprovalChainStepStatus =
  | 'upcoming'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'cancelled';

export interface ApprovalChainStep {
  step_number: number;
  step_role: ApprovalStepRole;
  status: ApprovalChainStepStatus;
  acted_at?: string | null;
  actor_name?: string | null;
  remarks?: string | null;
}

const STATE_STYLE: Record<ApprovalChainStepStatus, { dot: string; label: string }> = {
  upcoming: { dot: 'border-border bg-muted text-muted-foreground', label: 'Upcoming' },
  pending: { dot: 'border-amber-500/60 bg-amber-500/15 text-amber-700', label: 'Waiting' },
  approved: {
    dot: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700',
    label: 'Approved',
  },
  rejected: { dot: 'border-destructive/60 bg-destructive/15 text-destructive', label: 'Rejected' },
  revision_requested: {
    dot: 'border-orange-500/60 bg-orange-500/15 text-orange-700',
    label: 'Revision requested',
  },
  cancelled: { dot: 'border-border bg-muted text-muted-foreground', label: 'Cancelled' },
};

/**
 * Ordered approval flow for one record: which reviewer owns each step and how
 * far the record has moved. Configured-only chains (draft records) render as
 * every step "Upcoming".
 */
export function ApprovalChain({
  name,
  steps,
}: {
  /** Chain name from approval_chains, e.g. "Standard submission chain". */
  name: string;
  steps: ApprovalChainStep[];
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No approval chain is configured for this module yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {name}
      </p>
      <ol className="space-y-3">
        {steps.map((step) => {
          const state = STATE_STYLE[step.status];
          const waiting = step.status === 'pending';
          return (
            <li key={step.step_number} className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  state.dot
                )}
              >
                {step.step_number}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-medium">
                    {APPROVAL_STEP_ROLE_LABELS[step.step_role]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state.label}
                    {step.actor_name ? ` · ${step.actor_name}` : ''}
                    {step.acted_at ? ` · ${formatDate(step.acted_at)}` : ''}
                  </p>
                </div>
                {waiting ? (
                  <p className="text-xs text-muted-foreground">
                    This reviewer is the current owner of the record.
                  </p>
                ) : null}
                {step.remarks ? (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs whitespace-pre-wrap">
                    {step.remarks}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
