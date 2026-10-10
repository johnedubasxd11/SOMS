import { PageHeader } from '@/components/layout/page-header';
import { SubmissionFilters } from '@/components/submissions/submission-filters';
import { SubmissionTable } from '@/components/submissions/submission-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { QUEUE_STATUSES, type SubmissionStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

function isQueueStatus(value: string | undefined): value is SubmissionStatus {
  return !!value && QUEUE_STATUSES.includes(value as SubmissionStatus);
}

/**
 * Everything whose approval chain has reached OSA. Proposals resting at an
 * adviser or dean step are that reviewer's turn, not OSA's - records without
 * any pending step (legacy rows) stay visible so nothing disappears.
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; org?: string }>;
}) {
  await requireRole('osa_admin', 'super_admin');

  const { q, status, org } = await searchParams;
  const query = sanitize(q ?? '');
  const statusFilter = isQueueStatus(status) ? status : '';

  const supabase = await createClient();
  let builder = supabase
    .from('v_activity_proposal_list')
    .select('*')
    .in('status', QUEUE_STATUSES);

  if (query) {
    builder = builder.or(
      `title.ilike.%${query}%,reference_number.ilike.%${query}%`
    );
  }
  if (statusFilter) builder = builder.eq('status', statusFilter);
  if (org) builder = builder.eq('organization_id', org);

  const [{ data: rows }, { data: organizations }, { data: pending }] =
    await Promise.all([
      builder.order('submitted_at', { ascending: true, nullsFirst: false }),
      supabase.from('organizations').select('id, name').order('name'),
      supabase
        .from('v_pending_approval')
        .select('record_id, step_role')
        .eq('record_type', 'activity_proposal'),
    ]);

  const stepByRecord = new Map<string, string>();
  for (const row of pending ?? []) {
    if (row.record_id) stepByRecord.set(row.record_id, row.step_role ?? '');
  }

  const visible = (rows ?? []).filter((row) => {
    if (!row.id) return true;
    const step = stepByRecord.get(row.id);
    return step === undefined || step === 'osa_admin';
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Proposals whose approval chain has reached OSA - pick up the review or make the final decision."
      />

      <SubmissionFilters
        action="/osa/reviews"
        values={{ q, status: statusFilter, org }}
        statuses={QUEUE_STATUSES}
        organizations={organizations ?? []}
      />

      <Card>
        <CardContent className="p-0">
          <SubmissionTable
            rows={visible}
            basePath="/proposals"
            emptyMessage="The review queue is empty."
          />
        </CardContent>
      </Card>
    </div>
  );
}
