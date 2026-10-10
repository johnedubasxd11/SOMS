import { z } from 'zod';

export const AUDIT_DOC_TYPES = [
  'financial_statement',
  'receipt',
  'audit_report',
  'other',
] as const;

export type AuditDocType = (typeof AUDIT_DOC_TYPES)[number];

export const AUDIT_DOC_TYPE_LABELS: Record<AuditDocType, string> = {
  financial_statement: 'Financial Statement',
  receipt: 'Receipt',
  audit_report: 'Audit Report',
  other: 'Other',
};

export const SEMESTERS = ['first', 'second', 'summer'] as const;

export type Semester = (typeof SEMESTERS)[number];

export const SEMESTER_LABELS: Record<Semester, string> = {
  first: 'First Semester',
  second: 'Second Semester',
  summer: 'Summer',
};

/**
 * Audit document fields - organization, school year and the workflow status
 * are checked server-side against the signed-in profile.
 */
export const auditDocumentSchema = z.object({
  id: z.uuid('Invalid document id').optional(),
  title: z
    .string()
    .trim()
    .min(5, 'Enter a descriptive title (at least 5 characters)')
    .max(200, 'Title is too long'),
  description: z.string().trim().max(4000, 'Description is too long').optional(),
  doc_type: z.enum(AUDIT_DOC_TYPES, 'Pick a document type'),
  semester: z.enum(SEMESTERS, 'Pick a semester'),
});

export type AuditDocumentInput = z.infer<typeof auditDocumentSchema>;
