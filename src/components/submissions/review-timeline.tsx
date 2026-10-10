import { REVIEW_ACTION_LABELS, ROLE_LABELS, type ReviewAction } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';

export interface ReviewLogEntry {
  id: number;
  from_status: string | null;
  to_status: string | null;
  action: ReviewAction;
  remarks: string | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
}

export function ReviewTimeline({ entries }: { entries: ReviewLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No review activity yet - the timeline starts when the record is
        submitted.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex gap-3">
          <span
            aria-hidden
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-medium">
                {REVIEW_ACTION_LABELS[entry.action] ?? entry.action}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.actor_name ?? 'System'}
                {entry.actor_role
                  ? ` · ${ROLE_LABELS[entry.actor_role as keyof typeof ROLE_LABELS] ?? entry.actor_role}`
                  : ''}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {entry.from_status && entry.to_status
                ? `${entry.from_status} → ${entry.to_status}`
                : (entry.to_status ?? '')}
              {' · '}
              {formatDateTime(entry.created_at)}
            </p>
            {entry.remarks ? (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">
                {entry.remarks}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
