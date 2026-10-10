import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { requireRole } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/server';

/**
 * Read-only audit trail (OSA + Super Admin - the RLS policy audit_logs_select
 * enforces the same gate in the database). Every workflow action writes a row
 * through the log_audit() triggers; this page is the viewer.
 *
 * Changes are pre-computed server-side: only the keys whose value actually
 * changed are shown, with a compact before -> after rendering.
 */

const PAGE_SIZE = 50;

const AUDIT_TABLES = [
  'activity_proposals',
  'accomplishment_reports',
  'audit_documents',
  'other_documents',
  'hardcopy_records',
  'requirements',
  'organizations',
  'profiles',
  'notifications',
  'school_years',
  'review_logs',
] as const;

const ACTIONS = ['INSERT', 'UPDATE', 'DELETE'] as const;

const FIELD_CLASS =
  'h-8 min-w-40 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

const ACTION_TONE: Record<string, string> = {
  INSERT: 'bg-emerald-500/15 text-emerald-700',
  UPDATE: 'bg-blue-500/15 text-blue-700',
  DELETE: 'bg-destructive/15 text-destructive',
};

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 ._@-]/g, '').slice(0, 60);
}

/** jsonb column values arrive as the generic Json union. */
function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Keys whose value actually changed, in stable order. */
function changedKeys(oldData: unknown, newData: unknown): string[] {
  const before = asObject(oldData);
  const after = asObject(newData);
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter(
    (key) =>
      JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null)
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return JSON.stringify(value);
}

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{
    table?: string;
    action?: string;
    actor?: string;
    page?: string;
  }>;
}) {
  await requireRole('osa_admin', 'super_admin');

  const params = await searchParams;
  const table = params.table && (AUDIT_TABLES as readonly string[]).includes(params.table)
    ? params.table
    : undefined;
  const action = params.action && (ACTIONS as readonly string[]).includes(params.action)
    ? params.action
    : undefined;
  const actor = sanitize(params.actor ?? '');
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let builder = supabase
    .from('audit_logs')
    .select(
      'id, table_name, record_id, action, old_data, new_data, changed_by_email, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (table) builder = builder.eq('table_name', table);
  if (action) builder = builder.eq('action', action);
  if (actor) builder = builder.ilike('changed_by_email', `%${actor}%`);

  const { data: rows, count } = await builder;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const queryString = (nextPage: number) => {
    const search = new URLSearchParams();
    if (table) search.set('table', table);
    if (action) search.set('action', action);
    if (actor) search.set('actor', actor);
    if (nextPage > 1) search.set('page', String(nextPage));
    const text = search.toString();
    return text ? `?${text}` : '';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Every create, edit and status change recorded by the system - newest first. Read-only."
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="actor"
          defaultValue={actor}
          placeholder="Filter by actor e-mail"
          aria-label="Filter by actor e-mail"
          className="h-9 max-w-56"
        />

        <select
          name="table"
          defaultValue={table ?? ''}
          aria-label="Filter by table"
          className={FIELD_CLASS}
        >
          <option value="">All tables</option>
          {AUDIT_TABLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          name="action"
          defaultValue={action ?? ''}
          aria-label="Filter by action"
          className={FIELD_CLASS}
        >
          <option value="">All actions</option>
          {ACTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {table || action || actor ? (
          <Link href="/osa/audit-trail" className="text-sm text-muted-foreground hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead className="w-40">Actor</TableHead>
                <TableHead className="w-44">Record</TableHead>
                <TableHead className="w-24">Action</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rows || rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No audit entries match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const oldObj = asObject(row.old_data);
                  const newObj = asObject(row.new_data);
                  const allKeys = changedKeys(row.old_data, row.new_data);
                  const keys = allKeys.slice(0, 6);
                  return (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.changed_by_email ?? (
                          <span className="text-muted-foreground">system</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs">{row.table_name}</p>
                        {row.record_id ? (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.record_id}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('border-transparent', ACTION_TONE[row.action])}
                        >
                          {row.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {keys.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {row.action === 'INSERT'
                              ? 'Record created'
                              : row.action === 'DELETE'
                                ? 'Record removed'
                                : 'No field changes'}
                          </span>
                        ) : (
                          <ul className="space-y-1">
                            {keys.map((key) => (
                              <li key={key} className="text-xs">
                                <span className="font-medium">{key}</span>{' '}
                                <span className="text-muted-foreground line-through">
                                  {renderValue(oldObj?.[key])}
                                </span>{' '}
                                <span aria-hidden>&rarr;</span>{' '}
                                <span>{renderValue(newObj?.[key])}</span>
                              </li>
                            ))}
                            {allKeys.length > keys.length ? (
                              <li className="text-[11px] text-muted-foreground">
                                +{allKeys.length - keys.length} more
                              </li>
                            ) : null}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <p className="text-muted-foreground">
            {count?.toLocaleString() ?? 0} entries - page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/osa/audit-trail${queryString(page - 1)}`}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={`/osa/audit-trail${queryString(page + 1)}`}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted"
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
