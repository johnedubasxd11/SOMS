import {
  SubmissionList,
  type SubmissionListValues,
} from '@/components/submissions/submission-list';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SubmissionListValues>;
}) {
  return (
    <SubmissionList
      moduleKey="documents"
      searchParams={searchParams}
      description="Resolutions, memos, minutes and other governed documents submitted through the OSA workflow."
      newLabel="New document"
      noun="document"
      emptyMessage="No other documents yet - officers can create the first one."
    />
  );
}
