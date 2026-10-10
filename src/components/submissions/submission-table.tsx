import Link from 'next/link';
import { Paperclip } from 'lucide-react';

import { StatusBadge } from '@/components/submissions/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import type { SubmissionStatus } from '@/lib/labels';

export interface SubmissionListRow {
  id: string | null;
  reference_number: string | null;
  title: string | null;
  status: SubmissionStatus | null;
  organization_name: string | null;
  activity_date?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  attachment_count: number | null;
  record_type?: string | null;
}

export function SubmissionTable({
  rows,
  basePath,
  emptyMessage,
  showOrganization = true,
  showFiles = true,
  dateField = 'created_at',
  dateLabel = 'Created',
  hrefFor,
}: {
  rows: SubmissionListRow[];
  basePath: string;
  emptyMessage: string;
  showOrganization?: boolean;
  showFiles?: boolean;
  dateField?: 'activity_date' | 'created_at' | 'submitted_at';
  dateLabel?: string;
  /** Mixed queues (e.g. /reviews) link through the row's own module route. */
  hrefFor?: (row: SubmissionListRow) => string;
}) {
  const columns = 3 + (showOrganization ? 1 : 0) + (showFiles ? 1 : 0) + 1;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Reference</TableHead>
            <TableHead>Title</TableHead>
            {showOrganization ? <TableHead className="w-56">Organization</TableHead> : null}
            <TableHead className="w-36">{dateLabel}</TableHead>
            {showFiles ? (
              <TableHead className="w-24 text-center">Files</TableHead>
            ) : null}
            <TableHead className="w-40 text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {row.reference_number ?? '—'}
                </TableCell>
                <TableCell>
                  <Link
                    href={hrefFor ? hrefFor(row) : `${basePath}/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.title ?? 'Untitled'}
                  </Link>
                </TableCell>
                {showOrganization ? (
                  <TableCell className="text-muted-foreground">
                    {row.organization_name ?? '—'}
                  </TableCell>
                ) : null}
                <TableCell className="text-muted-foreground">
                  {formatDate(row[dateField] ?? null)}
                </TableCell>
                {showFiles ? (
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                      <Paperclip className="size-3.5" />
                      {row.attachment_count ?? 0}
                    </span>
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <StatusBadge status={row.status ?? 'draft'} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
