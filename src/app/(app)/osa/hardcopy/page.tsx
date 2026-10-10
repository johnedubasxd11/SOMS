import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { HardcopyActions } from '@/components/hardcopy/hardcopy-actions';
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
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import {
  COPY_STATUS_LABELS,
  COPY_STATUS_TONE,
  COPY_STATUS_VALUES,
  type CopyStatus,
  type SubmissionStatus,
} from '@/lib/labels';
import { SUBMISSION_MODULES, type RecordType } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';
import { cn } from 'cn';

/** Rows per module pulled into the tracker (newest approvals first). */
const MAX_ROWS = 100;

const FIELD_CLASS =
  'h-8 min-w-40 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

interface HardcopyListRow {
  recordType: RecordType;
  recordId: string;
  basePath: string;
  referenceNumber: string | null;
  title: string | null;
  organizationName: string | null;
  status: SubmissionStatus | null;
  approvedAt: string | null;
  received: boolean;
  receivedAt: string | null;
  receiverName: string | null;
}

function CopyBadge({ value }: { value: CopyStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 border-transparent', COPY_STATUS_TONE[value])}
    >
      {COPY_STATUS_LABELS[value]}
    </Badge>
  );
}

/**
 * OSA tracker for the paper copies: every approved submission (and every record
 * whose paper copy is already in) across the four modules, with the receipt
 * action and the printable QR cover sheet.
 */
export default async function HardcopyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string; state?: string }>;
}) {
  await requireRole('osa_admin', 'super_admin');

  const { q, module: moduleKey, state } = await searchParams;
  const search = sanitize(q ?? '').toLowerCase();
  const selectedModule =
    moduleKey && moduleKey in SUBMISSION_MODULES ? moduleKey : '';
  const selectedState =
    state === 'awaiting' || state === 'received' ? state : '';

  const supabase = await createClient();

  const modules = Object.values(SUBMISSION_MODULES).filter(
    (entry) => !selectedModule || entry.key === selectedModule
  );

  const [lists, hardcopiesResult] = await Promise.all([
    Promise.all(
      modules.map(async (entry) => {
        const { data } = await supabase
          .from(entry.view)
          .select('*')
          .or('status.eq.approved,hardcopy_received.eq.true')
          .limit(MAX_ROWS);

        return (data ?? []).map((row) => ({
          recordType: entry.recordType as RecordType,
          recordId: row.id ?? '',
          basePath: entry.basePath,
          referenceNumber: row.reference_number ?? null,
          title: row.title ?? null,
          organizationName: row.organization_name ?? null,
          status: (row.status ?? null) as SubmissionStatus | null,
          approvedAt: row.approved_at ?? null,
          received: Boolean(row.hardcopy_received),
          receivedAt: row.hardcopy_received_at ?? null,
          receiverName: null as string | null,
        }));
      })
    ),
    supabase
      .from('hardcopy_records')
      .select('record_type, record_id, receiver_name'),
  ]);

  const receiverByKey = new Map(
    (hardcopiesResult.data ?? []).map((entry) => [
      `${entry.record_type}:${entry.record_id}`,
      entry.receiver_name,
    ])
  );

  let rows: HardcopyListRow[] = lists.flat().map((row) => ({
    ...row,
    receiverName:
      receiverByKey.get(`${row.recordType}:${row.recordId}`) ?? row.receiverName,
  }));

  if (selectedState === 'awaiting') rows = rows.filter((row) => !row.received);
  if (selectedState === 'received') rows = rows.filter((row) => row.received);
  if (search) {
    rows = rows.filter((row) =>
      `${row.referenceNumber ?? ''} ${row.title ?? ''}`
        .toLowerCase()
        .includes(search)
    );
  }

  rows.sort((a, b) =>
    String(b.approvedAt ?? b.recordId).localeCompare(
      String(a.approvedAt ?? a.recordId)
    )
  );
  rows = rows.slice(0, MAX_ROWS);

  const awaiting = rows.filter((row) => !row.received).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardcopy Tracking"
        description="Paper copies received by OSA, with printable QR cover sheets for the folders."
      />

      <form
        method="get"
        action="/osa/hardcopy"
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search title or reference"
          aria-label="Search records"
          className="w-full sm:w-72"
        />

        <select
          name="module"
          defaultValue={selectedModule}
          aria-label="Filter by module"
          className={FIELD_CLASS}
        >
          <option value="">All modules</option>
          {Object.values(SUBMISSION_MODULES).map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.listLabel}
            </option>
          ))}
        </select>

        <select
          name="state"
          defaultValue={selectedState}
          aria-label="Filter by hardcopy state"
          className={FIELD_CLASS}
        >
          <option value="">All states</option>
          <option value="awaiting">Awaiting hardcopy</option>
          <option value="received">Hardcopy received</option>
        </select>

        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        <Link
          href="/osa/hardcopy"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear
        </Link>
      </form>

      <Card>
        <CardContent className="space-y-4 p-0">
          <div className="px-4 pt-4 text-sm text-muted-foreground">
            {rows.length} record{rows.length === 1 ? '' : 's'} · {awaiting}{' '}
            awaiting hardcopy
            {rows.length === MAX_ROWS ? ' · showing the latest 100' : ''}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-52">Organization</TableHead>
                  <TableHead className="w-44">Module</TableHead>
                  <TableHead className="w-32">Approved</TableHead>
                  <TableHead className="w-44">Copy</TableHead>
                  <TableHead className="w-64 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No submissions match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.recordType}:${row.recordId}`}>
                      <TableCell className="font-mono text-xs">
                        {row.referenceNumber ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`${row.basePath}/${row.recordId}`}
                          className="font-medium hover:underline"
                        >
                          {row.title ?? 'Untitled'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.organizationName ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {SUBMISSION_MODULES[
                          row.recordType === 'activity_proposal'
                            ? 'proposals'
                            : row.recordType === 'accomplishment_report'
                              ? 'reports'
                              : row.recordType === 'audit_document'
                                ? 'audit'
                                : 'documents'
                        ].label}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.approvedAt)}
                      </TableCell>
                      <TableCell>
                        <CopyBadge
                          value={
                            (COPY_STATUS_VALUES.includes(
                              row.received && row.status === 'approved'
                                ? 'complete'
                                : row.received
                                  ? 'hardcopy_received'
                                  : 'softcopy_only'
                            )
                              ? row.received && row.status === 'approved'
                                ? 'complete'
                                : row.received
                                  ? 'hardcopy_received'
                                  : 'softcopy_only'
                              : 'softcopy_only') as CopyStatus
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <HardcopyActions
                          record={{
                            recordType: row.recordType,
                            recordId: row.recordId,
                            referenceNumber: row.referenceNumber ?? '',
                            title: row.title ?? '',
                            organizationName: row.organizationName ?? '',
                            moduleLabel: 'submission',
                            received: row.received,
                            receivedAt: row.receivedAt,
                            receiverName: row.receiverName,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
