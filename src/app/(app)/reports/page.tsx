import {
  SubmissionList,
  type SubmissionListValues,
} from '@/components/submissions/submission-list';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SubmissionListValues>;
}) {
  return (
    <SubmissionList
      moduleKey="reports"
      searchParams={searchParams}
      description="Record what your organization accomplished - linked to an approved activity and reviewed by OSA."
      newLabel="New report"
      noun="report"
      emptyMessage="No accomplishment reports yet - officers can create the first one."
    />
  );
}
