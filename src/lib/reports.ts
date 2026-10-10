import 'server-only';

import type { Database } from '@/lib/database.types';
import { formatMoney } from '@/lib/format';
import type { createClient } from '@/lib/supabase/server';
import { ACCREDITATION_LABELS } from '@/lib/validations/organizations';

/**
 * Phase 6 report definitions.
 *
 * One column spec drives three renderers - the HTML table on /osa/reports,
 * the Excel workbook and the PDF - so the three outputs can never drift
 * apart. Widths are Excel character widths; the PDF scales them to fit
 * landscape A4 proportionally, which is why they must sum to a sane total.
 */

export type SummaryClient = Awaited<ReturnType<typeof createClient>>;

export type OrgSummaryRow =
  Database['public']['Views']['v_organization_summary']['Row'];
export type CollegeSummaryRow =
  Database['public']['Views']['v_activity_summary_by_college']['Row'];

type ColumnKind = 'text' | 'count' | 'money';

export interface ReportColumn<Row> {
  key: string;
  header: string;
  /** Excel character width; PDF scales these proportionally to page width. */
  width: number;
  kind: ColumnKind;
  value: (row: Row) => string | number;
}

export const ORG_SUMMARY_COLUMNS: ReportColumn<OrgSummaryRow>[] = [
  {
    key: 'college_name',
    header: 'College',
    width: 24,
    kind: 'text',
    value: (row) => row.college_name ?? '-',
  },
  {
    key: 'organization_code',
    header: 'Code',
    width: 9,
    kind: 'text',
    value: (row) => row.organization_code ?? '-',
  },
  {
    key: 'organization_name',
    header: 'Organization',
    width: 30,
    kind: 'text',
    value: (row) => row.organization_name ?? '-',
  },
  {
    key: 'accreditation_status',
    header: 'Accreditation',
    width: 14,
    kind: 'text',
    value: (row) =>
      (row.accreditation_status &&
        ACCREDITATION_LABELS[row.accreditation_status]) ??
      row.accreditation_status ??
      '-',
  },
  {
    key: 'membership_count',
    header: 'Members',
    width: 9,
    kind: 'count',
    value: (row) => row.membership_count ?? 0,
  },
  {
    key: 'total_proposals',
    header: 'Proposals',
    width: 10,
    kind: 'count',
    value: (row) => row.total_proposals ?? 0,
  },
  {
    key: 'approved_proposals',
    header: 'Approved',
    width: 9,
    kind: 'count',
    value: (row) => row.approved_proposals ?? 0,
  },
  {
    key: 'pending_proposals',
    header: 'Pending',
    width: 9,
    kind: 'count',
    value: (row) => row.pending_proposals ?? 0,
  },
  {
    key: 'approved_budget',
    header: 'Approved budget',
    width: 16,
    kind: 'money',
    value: (row) => row.approved_budget ?? 0,
  },
  {
    key: 'total_reports',
    header: 'Reports',
    width: 9,
    kind: 'count',
    value: (row) => row.total_reports ?? 0,
  },
  {
    key: 'total_audit_documents',
    header: 'Audit docs',
    width: 11,
    kind: 'count',
    value: (row) => row.total_audit_documents ?? 0,
  },
  {
    key: 'open_requirements',
    header: 'Req. open',
    width: 11,
    kind: 'count',
    value: (row) => row.open_requirements ?? 0,
  },
  {
    key: 'overdue_requirements',
    header: 'Req. overdue',
    width: 12,
    kind: 'count',
    value: (row) => row.overdue_requirements ?? 0,
  },
];

export const COLLEGE_SUMMARY_COLUMNS: ReportColumn<CollegeSummaryRow>[] = [
  {
    key: 'college_name',
    header: 'College',
    width: 28,
    kind: 'text',
    value: (row) => row.college_name ?? '-',
  },
  {
    key: 'organization_count',
    header: 'Organizations',
    width: 14,
    kind: 'count',
    value: (row) => row.organization_count ?? 0,
  },
  {
    key: 'total_proposals',
    header: 'Proposals',
    width: 12,
    kind: 'count',
    value: (row) => row.total_proposals ?? 0,
  },
  {
    key: 'approved_proposals',
    header: 'Approved',
    width: 11,
    kind: 'count',
    value: (row) => row.approved_proposals ?? 0,
  },
  {
    key: 'pending_proposals',
    header: 'Pending',
    width: 11,
    kind: 'count',
    value: (row) => row.pending_proposals ?? 0,
  },
  {
    key: 'approved_budget',
    header: 'Approved budget',
    width: 18,
    kind: 'money',
    value: (row) => row.approved_budget ?? 0,
  },
  {
    key: 'total_reports',
    header: 'Reports',
    width: 11,
    kind: 'count',
    value: (row) => row.total_reports ?? 0,
  },
  {
    key: 'approved_reports',
    header: 'Approved reports',
    width: 17,
    kind: 'count',
    value: (row) => row.approved_reports ?? 0,
  },
  {
    key: 'total_audit_documents',
    header: 'Audit docs',
    width: 13,
    kind: 'count',
    value: (row) => row.total_audit_documents ?? 0,
  },
];

/**
 * Render one cell for the HTML table.
 *
 * `moneyStyle` switches the currency prefix: PDFs are typeset with the
 * built-in Helvetica, which has no `₱` glyph, so they say "PHP 1,234.00".
 */
export function formatCell<Row>(
  column: ReportColumn<Row>,
  row: Row,
  moneyStyle: 'peso' | 'php' = 'peso'
): string {
  const value = column.value(row);
  if (typeof value !== 'number') return value;
  if (column.kind === 'money') {
    if (moneyStyle === 'peso') return formatMoney(value);
    return `PHP ${value.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value.toLocaleString('en-PH');
}

/** Sum of a numeric column - used by the totals row in all three renderers. */
export function columnTotal<Row>(
  column: ReportColumn<Row>,
  rows: Row[]
): number | null {
  if (column.kind === 'text') return null;
  return rows.reduce((sum, row) => {
    const value = column.value(row);
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

export function formatTotal<Row>(
  column: ReportColumn<Row>,
  rows: Row[],
  moneyStyle: 'peso' | 'php' = 'peso'
): string {
  const total = columnTotal(column, rows);
  if (total === null) return '';
  if (column.kind === 'money') {
    if (moneyStyle === 'peso') return formatMoney(total);
    return `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return total.toLocaleString('en-PH');
}

/** Safe file-name fragment, e.g. "2026-2027". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Loaders - always scoped to one school year so page and export agree.
// ---------------------------------------------------------------------------

export async function loadSchoolYears(client: SummaryClient) {
  const { data, error } = await client
    .from('school_years')
    .select('id, name, is_current')
    .order('start_date', { ascending: false });
  if (error) throw new Error(`Failed to load school years: ${error.message}`);
  return data ?? [];
}

export async function loadOrgSummary(client: SummaryClient, schoolYearId: string) {
  const { data, error } = await client
    .from('v_organization_summary')
    .select('*')
    .eq('school_year_id', schoolYearId)
    .order('college_name')
    .order('organization_name');
  if (error) throw new Error(`Failed to load organization summary: ${error.message}`);
  return data ?? [];
}

export async function loadCollegeSummary(
  client: SummaryClient,
  schoolYearId: string
) {
  const { data, error } = await client
    .from('v_activity_summary_by_college')
    .select('*')
    .eq('school_year_id', schoolYearId)
    .order('college_name');
  if (error) throw new Error(`Failed to load college summary: ${error.message}`);
  return data ?? [];
}
