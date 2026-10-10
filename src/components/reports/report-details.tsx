import { Detail, type SubmissionDetailRow } from '@/components/submissions/submission-detail';
import { formatMoney } from '@/lib/format';

/** Accomplishment-specific fields, rendered by the shared detail page. */
export function ReportDetails({ row }: { row: SubmissionDetailRow }) {
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail
          label="Attendance"
          value={
            row.attendance_count != null
              ? row.attendance_count.toLocaleString('en-PH')
              : null
          }
        />
        <Detail label="Budget spent" value={formatMoney(row.budget_spent)} />
        <Detail label="Linked activity" value={row.activity_title} />
        <Detail label="Prepared by" value={row.created_by_name} />
      </dl>

      {row.summary ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Summary
          </p>
          <p className="text-sm whitespace-pre-wrap">{row.summary}</p>
        </div>
      ) : null}

      {row.outcomes ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Outcomes
          </p>
          <p className="text-sm whitespace-pre-wrap">{row.outcomes}</p>
        </div>
      ) : null}

      {row.liquidation_summary ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Liquidation summary
          </p>
          <p className="text-sm whitespace-pre-wrap">{row.liquidation_summary}</p>
        </div>
      ) : null}
    </>
  );
}
