import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { SubmissionFilters } from '@/components/submissions/submission-filters';
import {
  SubmissionTable,
  type SubmissionListRow,
} from '@/components/submissions/submission-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/labels';
import { getModule } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 12;

export interface SubmissionListValues {
  q?: string;
  status?: string;
  org?: string;
  page?: string;
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

function isStatus(value: string | undefined): value is SubmissionStatus {
  return !!value && (SUBMISSION_STATUSES as string[]).includes(value);
}

function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (page > 1) query.set('page', String(page));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/**
 * The list page body shared by every submission module: filters, table and
 * pagination read from the module's list view, where RLS has already decided
 * which rows this account may see.
 */
export async function SubmissionList({
  moduleKey,
  searchParams,
  description,
  newLabel,
  noun,
  emptyMessage,
}: {
  moduleKey: string;
  searchParams: Promise<SubmissionListValues>;
  /** Page intro copy. */
  description: string;
  /** "New proposal" - only shown to roles that may create the mod. */
  newLabel: string;
  /** "proposal" - used in counts and empty states. */
  noun: string;
  /** Shown when nothing exists yet (no filters applied). */
  emptyMessage: string;
}) {
  const mod = getModule(moduleKey);
  if (!mod) throw new Error(`Unknown submission module: ${moduleKey}`);

  const profile = await requireProfile();
  const { q, status, org, page } = await searchParams;

  const query = sanitize(q ?? '');
  const statusFilter = isStatus(status) ? status : '';
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const canCreate = mod.createRoles.includes(profile.role);
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const from = (current - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let builder = supabase.from(mod.view).select('*', { count: 'exact' });

  if (query) {
    builder = builder.or(
      `title.ilike.%${query}%,reference_number.ilike.%${query}%`
    );
  }
  if (statusFilter) builder = builder.eq('status', statusFilter);
  if (isOsa && org) builder = builder.eq('organization_id', org);

  const [{ data, count }, { data: organizations }] = await Promise.all([
    builder
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    isOsa
      ? supabase.from('organizations').select('id, name').order('name')
      : Promise.resolve({ data: null }),
  ]);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows: SubmissionListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    reference_number: row.reference_number,
    title: row.title,
    status: row.status ?? 'draft',
    organization_name: row.organization_name,
    created_at: row.created_at,
    attachment_count: row.attachment_count,
    activity_date:
      'activity_date' in row && row.activity_date ? row.activity_date : null,
  }));

  const filtered = Boolean(query || statusFilter || org);

  return (
    <div className="space-y-6">
      <PageHeader title={mod.listLabel} description={description}>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`${mod.basePath}/new`}>
              <Plus /> {newLabel}
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <SubmissionFilters
        action={mod.basePath}
        values={{ q, status: statusFilter, org: isOsa ? org : undefined }}
        organizations={isOsa ? (organizations ?? []) : null}
      />

      <Card>
        <CardContent className="p-0">
          <SubmissionTable
            rows={rows}
            basePath={mod.basePath}
            emptyMessage={
              filtered
                ? `No ${noun} matches your filters.`
                : emptyMessage
            }
            dateField={moduleKey === 'proposals' ? 'activity_date' : 'created_at'}
            dateLabel={moduleKey === 'proposals' ? 'Activity date' : 'Created'}
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
              <Link
                className="hover:underline"
                href={pageHref(
                  mod.basePath,
                  { q, status: statusFilter, org },
                  current - 1
                )}
              >
                ← Previous
              </Link>
            ) : null}
            {current < pages ? (
              <Link
                className="hover:underline"
                href={pageHref(
                  mod.basePath,
                  { q, status: statusFilter, org },
                  current + 1
                )}
              >
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
