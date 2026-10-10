import { ReportDetails } from '@/components/reports/report-details';
import { SubmissionDetail } from '@/components/submissions/submission-detail';

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SubmissionDetail
      moduleKey="reports"
      id={id}
      detailsTitle="Accomplishment details"
      detailsDescription="What was delivered, how many attended and how the funds were spent."
      renderDetails={(row) => <ReportDetails row={row} />}
    />
  );
}
