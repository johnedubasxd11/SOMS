import { Detail, type SubmissionDetailRow } from '@/components/submissions/submission-detail';
import {
  OTHER_DOCUMENT_CATEGORY_LABELS,
  type OtherDocumentCategory,
} from '@/lib/validations/other-documents';

/** Category and notes of a governed document, rendered by the shared detail page. */
export function OtherDocumentDetails({ row }: { row: SubmissionDetailRow }) {
  const category = (row.category ?? 'other') as OtherDocumentCategory;

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail
          label="Category"
          value={OTHER_DOCUMENT_CATEGORY_LABELS[category] ?? String(row.category)}
        />
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
    </>
  );
}
