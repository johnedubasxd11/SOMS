import {
  Detail,
  type SubmissionDetailRow,
} from '@/components/submissions/submission-detail';
import {
  AUDIT_DOC_TYPE_LABELS,
  type AuditDocType,
  SEMESTER_LABELS,
  type Semester,
} from '@/lib/validations/audit-documents';

/** Type and semester of an audit document, rendered by the shared detail page. */
export function AuditDocumentDetails({ row }: { row: SubmissionDetailRow }) {
  const docType = (row.doc_type ?? 'other') as AuditDocType;
  const semester = (row.semester ?? 'first') as Semester;

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail
          label="Document type"
          value={AUDIT_DOC_TYPE_LABELS[docType] ?? String(row.doc_type)}
        />
        <Detail
          label="Semester"
          value={SEMESTER_LABELS[semester] ?? String(row.semester)}
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
