import 'server-only';

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

import { formatCell, formatTotal, type ReportColumn } from '@/lib/reports';

/**
 * PDF renderer for the Phase 6 summary reports (landscape A4).
 *
 * Column widths come from the same spec as the Excel and HTML renderers,
 * scaled proportionally to the printable width, so one spec drives all three.
 * The built-in Helvetica font is used (no network font fetch); its WinAnsi
 * encoding has no peso sign, hence the "PHP 1,234.00" money format.
 */

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_PADDING = 24;
const PRINTABLE_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2;

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#111827',
  },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#6B7280', marginBottom: 14 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  headerCell: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 7 },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  zebra: { backgroundColor: '#F9FAFB' },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: '#F3F4F6',
    fontWeight: 'bold',
  },
  cell: { fontSize: 7 },
});

export interface SummaryPdfMeta {
  title: string;
  schoolYearName: string;
}

export async function buildSummaryPdf<Row>(
  columns: ReportColumn<Row>[],
  rows: Row[],
  meta: SummaryPdfMeta
) {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const widths = columns.map(
    (column) => (column.width / totalWidth) * PRINTABLE_WIDTH
  );

  const renderRow = (row: Row, index: number) => (
    <View
      key={`row-${index}`}
      style={index % 2 === 1 ? [styles.row, styles.zebra] : styles.row}
      wrap
    >
      {columns.map((column, columnIndex) => (
        <Text
          key={column.key}
          style={[
            styles.cell,
            {
              width: widths[columnIndex],
              textAlign: column.kind === 'text' ? 'left' : 'right',
            },
          ]}
        >
          {formatCell(column, row, 'php')}
        </Text>
      ))}
    </View>
  );

  const document = (
    <Document title={meta.title} author="SOMS">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.subtitle}>
          {`School year ${meta.schoolYearName} - Generated ${new Date().toLocaleString(
            'en-PH'
          )}`}
        </Text>

        <View style={styles.headerRow} fixed>
          {columns.map((column, columnIndex) => (
            <Text
              key={column.key}
              style={[
                styles.headerCell,
                {
                  width: widths[columnIndex],
                  textAlign: column.kind === 'text' ? 'left' : 'right',
                },
              ]}
            >
              {column.header}
            </Text>
          ))}
        </View>

        {rows.map(renderRow)}

        <View style={styles.totalsRow}>
          {columns.map((column, columnIndex) => (
            <Text
              key={column.key}
              style={{
                width: widths[columnIndex],
                textAlign: column.kind === 'text' ? 'left' : 'right',
              }}
            >
              {columnIndex === 0 ? 'Total' : formatTotal(column, rows, 'php')}
            </Text>
          ))}
        </View>

        <Text
          style={{
            marginTop: 10,
            fontSize: 7,
            color: '#9CA3AF',
            textAlign: 'right',
          }}
        >
          {`SOMS - Office of Student Affairs - ${rows.length} row${
            rows.length === 1 ? '' : 's'
          }`}
        </Text>
      </Page>
    </Document>
  );

  return renderToBuffer(document);
}
