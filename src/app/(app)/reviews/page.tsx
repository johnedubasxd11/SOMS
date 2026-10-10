import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { SubmissionFilters } from '@/components/submissions/submission-filters';
import {
  SubmissionTable,
  type SubmissionListRow,
} from '@/components/submissions/submission-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { QUEUE_STATUSES, type SubmissionStatus } from '@/lib/labels';
import { moduleForRecordType } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 12;

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

function isStatus(value: string | undefined): value is SubmissionStatus {
  return !!value && (QUEUE_STATUSES as string[]).includes(value);
}

function pageHref(params: Record<string, string | undefined>, page: number): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (page > 1) query.set('page', String(page));
  const search = query.toString();
  return search ? `/reviews?${search}` : '/reviews';
}

/**
 * The approval queue for advisers and deans: every record whose CURRENT
 * pending approval step is owned by the caller (v_pending_approval is already
 * scoped by RLS, this page just filters by step role).
 */
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; org?: string; page?: string }>;
}) {
  const profile = await requireRole('adviser', 'dean');
  const stepRole = profile.role === 'adviser' ? 'adviser' : 'dean';
  const { q = '', status = '', org = '', page } = await searchParams;

  const query = sanitize(q);
  const statusFilter = isStatus(status) ? status : '';
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const from = (current - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let builder = supabase
    .from('v_pending_approval')
    .select('*', { count: 'exact' })
    .eq('step_role', stepRole);

  if (query) {
    builder = builder.or(`title.ilike.%${query}%,reference_number.ilike.%${query}%`);
  }
  if (statusFilter) builder = builder.eq('submission_status', statusFilter);
  if (org) builder = builder.eq('organization_id', org);

  const [{ data, count }, { data: organizations }] = await Promise.all([
    builder
      .order('submitted_at', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1),
    supabase.from('organizations').select('id, name').order('name'),
  ]);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows: SubmissionListRow[] = (data ?? []).map((row) => ({
    id: row.record_id,
    reference_number: row.reference_number,
    title: row.title,
    status: row.submission_status,
    organization_name: row.organization_name,
    submitted_at: row.submitted_at,
    attachment_count: null,
    record_type: row.record_type,
  }));

  const filtered = Boolean(query || statusFilter || org);
  const noun = 'submission';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My approvals"
        description={
          profile.role === 'adviser'
            ? 'Submissions from your organizations waiting for your endorsement.'
            : 'Submissions from your college waiting for your approval.'
        }
      />

      <SubmissionFilters
        action="/reviews"
        values={{ q, status: statusFilter, org }}
        statuses={QUEUE_STATUSES}
        organizations={(organizations ?? []) as { id: string; name: string }[]}
      />

      <Card>
        <CardContent className="p-0">
          <SubmissionTable
            rows={rows}
            basePath="/reviews"
            hrefFor={(row) => {
              const mod = moduleForRecordType(row.record_type);
              return mod ? `${mod.basePath}/${row.id}` : '/reviews';
            }}
            emptyMessage={
              filtered
                ? `No ${noun} matches your filters.`
                : profile.role === 'adviser'
                  ? 'No submission is waiting for your endorsement.'
                  : 'No submission is waiting for your approval.'
            }
            dateField="submitted_at"
            dateLabel="Submitted"
            showFiles={false}
          />
        </CardContent>
      </Card>

      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {total} {noun}
            {total === 1 ? '' : 's'} · page {current} of {pages}
          </p>
          <div className="flex gap-3">
            {current > 1 ? (
              <Link className="hover:underline" href={pageHref({ q, status: statusFilter, org }, current - 1)}>
                ← Previous
              </Link>
            ) : null}
            {current < pages ? (
              <Link className="hover:underline" href={pageHref({ q, status: statusFilter, org }, current + 1)}>
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
