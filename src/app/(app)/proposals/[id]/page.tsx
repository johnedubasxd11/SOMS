import { ProposalDetails } from '@/components/proposals/proposal-details';
import { SubmissionDetail } from '@/components/submissions/submission-detail';

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SubmissionDetail
      moduleKey="proposals"
      id={id}
      detailsTitle="Activity details"
      detailsDescription="Everything the adviser and OSA review before approving."
      renderDetails={(row) => <ProposalDetails row={row} />}
    />
  );
}
