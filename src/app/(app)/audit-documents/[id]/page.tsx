import { AuditDocumentDetails } from '@/components/audit-documents/audit-document-details';
import { SubmissionDetail } from '@/components/submissions/submission-detail';

export default async function AuditDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SubmissionDetail
      moduleKey="audit"
      id={id}
      detailsTitle="Audit document details"
      detailsDescription="Document type, semester and the notes OSA reviews before approving."
      renderDetails={(row) => <AuditDocumentDetails row={row} />}
    />
  );
}
