import 'server-only';

import ExcelJS from 'exceljs';

import { columnTotal, type ReportColumn } from '@/lib/reports';

/**
 * Excel renderer for the Phase 6 summary reports.
 *
 * Layout: a merged title block, then a styled header row (frozen + filtered),
 * data rows and a bold totals row. Counts and money are written as real
 * numbers with number formats so they stay summable inside Excel.
 */

const HEADER_ROW = 4; // title, subtitle, blank, header

export interface SummarySheetMeta {
  /** Worksheet tab name (max 31 chars). */
  sheetName: string;
  title: string;
  schoolYearName: string;
}

export async function buildSummaryWorkbook<Row>(
  columns: ReportColumn<Row>[],
  rows: Row[],
  meta: SummarySheetMeta
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(meta.sheetName);

  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  const lastColumn = columns.length;

  const titleRow = sheet.addRow([meta.title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, lastColumn);
  titleRow.getCell(1).font = { bold: true, size: 14 };

  const subtitleRow = sheet.addRow([
    `School year ${meta.schoolYearName} · Generated ${new Date().toLocaleString('en-PH')}`,
  ]);
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, lastColumn);
  subtitleRow.getCell(1).font = {
    italic: true,
    size: 10,
    color: { argb: 'FF6B7280' },
  };

  sheet.addRow([]); // spacer

  const headerRow = sheet.addRow(columns.map((column) => column.header));
  headerRow.height = 18;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF6B7280' } } };
  });

  for (const row of rows) {
    const cells = columns.map((column) => {
      const value = column.value(row);
      if (column.kind === 'text') return value;
      return typeof value === 'number' ? value : 0;
    });
    const dataRow = sheet.addRow(cells);
    columns.forEach((column, index) => {
      if (column.kind === 'text') return;
      const cell = dataRow.getCell(index + 1);
      cell.numFmt = column.kind === 'money' ? '#,##0.00' : '#,##0';
      cell.alignment = { horizontal: 'right' };
    });
  }

  const totals = sheet.addRow(
    columns.map((column, index) => {
      if (index === 0) return 'Total';
      const total = columnTotal(column, rows);
      return total ?? '';
    })
  );
  totals.height = 18;
  totals.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = { top: { style: 'thin', color: { argb: 'FF1F2937' } } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
  });
  columns.forEach((column, index) => {
    if (column.kind === 'text') return;
    const cell = totals.getCell(index + 1);
    cell.numFmt = column.kind === 'money' ? '#,##0.00' : '#,##0';
    cell.alignment = { horizontal: 'right' };
  });

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW - 1, activeCell: 'A5' }];
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: lastColumn },
  };

  return workbook.xlsx.writeBuffer();
}
