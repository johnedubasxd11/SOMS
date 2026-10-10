import {
  SubmissionList,
  type SubmissionListValues,
} from '@/components/submissions/submission-list';

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<SubmissionListValues>;
}) {
  return (
    <SubmissionList
      moduleKey="proposals"
      searchParams={searchParams}
      description="Draft, submit and track activity proposals through the OSA workflow."
      newLabel="New proposal"
      noun="proposal"
      emptyMessage="No proposals yet - officers can create the first one."
    />
  );
}
