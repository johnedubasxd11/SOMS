import { OtherDocumentDetails } from '@/components/documents/other-document-details';
import { SubmissionDetail } from '@/components/submissions/submission-detail';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SubmissionDetail
      moduleKey="documents"
      id={id}
      detailsTitle="Document details"
      detailsDescription="Category, description and supporting files for this governed document."
      renderDetails={(row) => <OtherDocumentDetails row={row} />}
    />
  );
}
