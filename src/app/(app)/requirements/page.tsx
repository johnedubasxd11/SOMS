import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListChecks } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import {
  REQUIREMENT_LABELS,
  REQUIREMENT_TONE,
  REQUIREMENT_VALUES,
} from '@/lib/labels';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/server';
import { RequirementForm } from '@/components/requirements/requirement-form';
import { RequirementRowActions } from '@/components/requirements/requirement-row-actions';
import { SweepButton } from '@/components/requirements/sweep-button';

const FIELD_CLASS =
  'h-8 min-w-36 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

/** Overdue-looking badge for open rows whose date has passed (RLS-safe). */
function isPastDue(status: string, dueDate: string | null): boolean {
  if (status !== 'open' || !dueDate) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await requireProfile();
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';

  const { q, status } = await searchParams;
  const query = sanitize(q ?? '');
  const statusFilter =
    status && (REQUIREMENT_VALUES as readonly string[]).includes(status)
      ? (status as (typeof REQUIREMENT_VALUES)[number])
      : undefined;

  const supabase = await createClient();
  let builder = supabase
    .from('requirements')
    .select(
      `id, title, description, due_date, status, completed_at, created_at,
       organizations(id, code, name),
       assignedBy:profiles!requirements_assigned_by_fkey(full_name)`
    )
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (query) builder = builder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
  if (statusFilter) builder = builder.eq('status', statusFilter);
  if (profile.organization_id) builder = builder.eq('organization_id', profile.organization_id);

  const [{ data: requirements }, { data: organizations }] = await Promise.all([
    builder,
    isOsa
      ? supabase.from('organizations').select('id, code, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; code: string; name: string }[] }),
  ]);

  const orgOptions = (organizations ?? []) as { id: string; code: string; name: string }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Requirements"
          description={
            isOsa
              ? 'Compliance checklists assigned to organizations. Overdue items are marked daily and officers are reminded once per day.'
              : 'Requirements your organization must complete for this school year.'
          }
        />
        <div className="flex items-center gap-2">
          {isOsa ? <SweepButton /> : null}
          {isOsa ? <RequirementForm organizations={orgOptions} /> : null}
        </div>
      </div>

      <form method="get" className="flex max-w-md gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search requirements"
          aria-label="Search requirements"
          className="h-9 flex-1"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ''}
          aria-label="Filter by status"
          className={FIELD_CLASS}
        >
          <option value="">All statuses</option>
          {REQUIREMENT_VALUES.map((value) => (
            <option key={value} value={value}>
              {REQUIREMENT_LABELS[value]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          Filter
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                {isOsa ? <TableHead className="w-40">Organization</TableHead> : null}
                <TableHead className="w-32">Due</TableHead>
                <TableHead className="w-28">Status</TableHead>
                {isOsa ? <TableHead className="w-48 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!requirements || requirements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isOsa ? 5 : 3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <ListChecks className="mx-auto mb-2 size-5" />
                    {query || statusFilter
                      ? 'No requirement matches your filters.'
                      : isOsa
                        ? 'No requirements assigned yet. Use "New requirement" to create one.'
                        : 'No requirements assigned to your organization yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                requirements.map((row) => {
                  const pastDue = isPastDue(row.status, row.due_date);
                  return (
                    <TableRow key={row.id} id={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.title}</p>
                        {row.description ? (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        ) : null}
                        {row.assignedBy ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Assigned by {row.assignedBy.full_name}
                          </p>
                        ) : null}
                      </TableCell>

                      {isOsa ? (
                        <TableCell className="text-sm text-muted-foreground">
                          <Link
                            href={`/organizations/${row.organizations?.id}`}
                            className="hover:underline"
                          >
                            {row.organizations?.name}
                          </Link>
                        </TableCell>
                      ) : null}

                      <TableCell className="text-sm">
                        {row.due_date ? (
                          <span
                            className={cn(
                              'tabular-nums',
                              pastDue && 'font-medium text-destructive'
                            )}
                          >
                            {formatDate(row.due_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No date</span>
                        )}
                        {row.completed_at ? (
                          <p className="text-[11px] text-muted-foreground">
                            Done {formatDate(row.completed_at)}
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-transparent',
                            REQUIREMENT_TONE[
                              pastDue ? 'overdue' : (row.status as (typeof REQUIREMENT_VALUES)[number])
                            ]
                          )}
                        >
                          {pastDue ? 'Overdue' : REQUIREMENT_LABELS[row.status as (typeof REQUIREMENT_VALUES)[number]]}
                        </Badge>
                      </TableCell>

                      {isOsa ? (
                        <TableCell className="text-right">
                          <RequirementRowActions
                            id={row.id}
                            title={row.title}
                            status={row.status}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isOsa ? (
        <p className="text-xs text-muted-foreground">
          Reminders run daily at 06:00 when pg_cron is installed; otherwise hit{' '}
          <code className="rounded bg-muted px-1">POST /api/cron/reminders</code>{' '}
          from your scheduler with a Bearer CRON_SECRET.
        </p>
      ) : null}
    </div>
  );
}
