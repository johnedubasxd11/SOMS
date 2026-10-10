import {
  SubmissionList,
  type SubmissionListValues,
} from '@/components/submissions/submission-list';

export default async function AuditDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SubmissionListValues>;
}) {
  return (
    <SubmissionList
      moduleKey="audit"
      searchParams={searchParams}
      description="Financial statements, receipts and audit reports per semester, reviewed by OSA."
      newLabel="New audit document"
      noun="audit document"
      emptyMessage="No audit documents yet - officers can create the first one."
    />
  );
}
