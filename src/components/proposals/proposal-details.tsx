import { Detail, type SubmissionDetailRow } from '@/components/submissions/submission-detail';
import { formatDate, formatMoney, formatTime } from '@/lib/format';

/** Activity-specific fields of a proposal, rendered by the shared detail page. */
export function ProposalDetails({ row }: { row: SubmissionDetailRow }) {
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Activity date" value={formatDate(row.activity_date)} />
        <Detail
          label="Venue"
          value={
            row.venue_name ? (
              <span>
                {row.venue_name}
                <span className="text-muted-foreground">
                  {' '}
                  (conflict-checked venue)
                </span>
              </span>
            ) : (
              row.venue
            )
          }
        />
        <Detail label="Start time" value={formatTime(row.start_time)} />
        <Detail label="End time" value={formatTime(row.end_time)} />
        <Detail
          label="Expected participants"
          value={
            row.participants_count != null
              ? row.participants_count.toLocaleString('en-PH')
              : null
          }
        />
        <Detail label="Budget" value={formatMoney(row.budget)} />
        <Detail label="Source of funds" value={row.source_of_funds} />
        <Detail label="Prepared by" value={row.created_by_name} />
      </dl>

      {row.description ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Description
          </p>
          <p className="text-sm whitespace-pre-wrap">{row.description}</p>
        </div>
      ) : null}

      {row.objectives ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Objectives
          </p>
          <p className="text-sm whitespace-pre-wrap">{row.objectives}</p>
        </div>
      ) : null}
    </>
  );
}
