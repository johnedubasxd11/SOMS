import { type NextRequest, NextResponse } from 'next/server';

import { getProfile } from '@/lib/auth';
import { buildSummaryWorkbook } from '@/lib/exports/summary-excel';
import { buildSummaryPdf } from '@/lib/exports/summary-pdf';
import {
  COLLEGE_SUMMARY_COLUMNS,
  ORG_SUMMARY_COLUMNS,
  type ReportColumn,
  loadCollegeSummary,
  loadOrgSummary,
  loadSchoolYears,
  slugify,
} from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exports/summary?scope=organizations|colleges&format=xlsx|pdf&year=<uuid>
 *
 * Downloads one summary table as a file. OSA-gated here in the handler (the
 * page gate is a redirect, which would turn a download into an HTML page), and
 * the queries use the caller's own session so RLS still applies. `year` is
 * optional and falls back to the current school year.
 */

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    return new NextResponse('Sign in required.', { status: 401 });
  }
  if (profile.role !== 'osa_admin' && profile.role !== 'super_admin') {
    return new NextResponse('Only OSA accounts can export reports.', {
      status: 403,
    });
  }

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get('scope') === 'colleges' ? 'colleges' : 'organizations';
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  const requestedYear = searchParams.get('year');

  const supabase = await createClient();
  const years = await loadSchoolYears(supabase);
  const year =
    years.find((candidate) => candidate.id === requestedYear) ??
    years.find((candidate) => candidate.is_current) ??
    years[0];
  if (!year) {
    return new NextResponse('No school year is configured yet.', { status: 404 });
  }

  const isOrganizations = scope === 'organizations';
  const title = isOrganizations
    ? 'SOMS Organization Summary'
    : 'SOMS College Summary';
  const baseName = `soms-${isOrganizations ? 'organization' : 'college'}-summary-${slugify(
    year.name
  )}`;
  const meta = { sheetName: isOrganizations ? 'Organizations' : 'Colleges', title, schoolYearName: year.name };

  if (isOrganizations) {
    const rows = await loadOrgSummary(supabase, year.id);
    return toResponse(format, ORG_SUMMARY_COLUMNS, rows, meta, baseName);
  }
  const rows = await loadCollegeSummary(supabase, year.id);
  return toResponse(format, COLLEGE_SUMMARY_COLUMNS, rows, meta, baseName);
}

async function toResponse<Row>(
  format: 'xlsx' | 'pdf',
  columns: ReportColumn<Row>[],
  rows: Row[],
  meta: { sheetName: string; title: string; schoolYearName: string },
  baseName: string
): Promise<NextResponse> {
  if (format === 'pdf') {
    const buffer = await buildSummaryPdf(columns, rows, {
      title: meta.title,
      schoolYearName: meta.schoolYearName,
    });
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const buffer = await buildSummaryWorkbook(columns, rows, meta);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
