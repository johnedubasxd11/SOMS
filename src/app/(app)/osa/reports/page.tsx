import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth';
import {
  COLLEGE_SUMMARY_COLUMNS,
  ORG_SUMMARY_COLUMNS,
  formatCell,
  formatTotal,
  loadCollegeSummary,
  loadOrgSummary,
  loadSchoolYears,
  type ReportColumn,
} from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';
import { FileSpreadsheet, FileText } from 'lucide-react';

/**
 * Phase 6 - OSA report screens.
 *
 * Native GET selects (the repo convention, not shadcn Select) pick a school
 * year; the same column specs and queries drive the Excel/PDF downloads from
 * /api/exports/summary, so the screen and the files always agree.
 */

const FIELD_CLASS =
  'h-8 min-w-40 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function alignmentClass<Row>(column: ReportColumn<Row>): string {
  return column.kind === 'text' ? '' : 'text-right tabular-nums';
}

function SummaryTable<Row>({
  columns,
  rows,
  emptyLabel,
}: {
  columns: ReportColumn<Row>[];
  rows: Row[];
  emptyLabel: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={alignmentClass(column)}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={alignmentClass(column)}
                >
                  {formatCell(column, row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          {columns.map((column, index) => (
            <TableCell key={column.key} className={alignmentClass(column)}>
              {index === 0 ? 'Total' : formatTotal(column, rows)}
            </TableCell>
          ))}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function ExportButtons({
  href,
}: {
  href: (format: 'xlsx' | 'pdf') => string;
}) {
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <a href={href('xlsx')}>
          <FileSpreadsheet aria-hidden data-icon="inline-start" />
          Excel
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={href('pdf')}>
          <FileText aria-hidden data-icon="inline-start" />
          PDF
        </a>
      </Button>
    </>
  );
}

export default async function OsaReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireRole('osa_admin', 'super_admin');

  const params = await searchParams;
  const supabase = await createClient();

  const years = await loadSchoolYears(supabase);
  const year =
    years.find((candidate) => candidate.id === params.year) ??
    years.find((candidate) => candidate.is_current) ??
    years[0];

  const [orgRows, collegeRows] = year
    ? await Promise.all([
        loadOrgSummary(supabase, year.id),
        loadCollegeSummary(supabase, year.id),
      ])
    : [[], []];

  const exportHref =
    (scope: 'organizations' | 'colleges') =>
    (format: 'xlsx' | 'pdf') =>
      `/api/exports/summary?scope=${scope}&format=${format}&year=${year?.id ?? ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Exports"
        description="Per organization, per college and per school year summaries in Excel and PDF."
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <label htmlFor="year" className="text-sm text-muted-foreground">
          School year
        </label>
        <select
          id="year"
          name="year"
          defaultValue={year?.id ?? ''}
          disabled={years.length === 0}
          className={FIELD_CLASS}
        >
          {years.length === 0 ? (
            <option value="">No school year configured</option>
          ) : (
            years.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
                {candidate.is_current ? ' (current)' : ''}
              </option>
            ))
          )}
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        <Link
          href="/osa/reports"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear
        </Link>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Organization summary</CardTitle>
          <CardDescription>
            {year
              ? `${orgRows.length} active organizations · School year ${year.name}`
              : 'Select a school year to see a summary.'}
          </CardDescription>
          <CardAction className="flex gap-2">
            <ExportButtons href={exportHref('organizations')} />
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <SummaryTable
            columns={ORG_SUMMARY_COLUMNS}
            rows={orgRows}
            emptyLabel="No organizations match this school year."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>College summary</CardTitle>
          <CardDescription>
            {year
              ? `Totals rolled up per college · School year ${year.name}`
              : 'Select a school year to see a summary.'}
          </CardDescription>
          <CardAction className="flex gap-2">
            <ExportButtons href={exportHref('colleges')} />
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <SummaryTable
            columns={COLLEGE_SUMMARY_COLUMNS}
            rows={collegeRows}
            emptyLabel="No colleges match this school year."
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Exports use the same data as this screen and are limited to your OSA
        account. Files download as{' '}
        <span className="font-mono">
          soms-organization-summary-{year?.name}
        </span>
        .
      </p>
    </div>
  );
}
