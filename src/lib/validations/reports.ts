import { z } from 'zod';

/**
 * Accomplishment report fields - organization, school year and the linked
 * activity are checked server-side against the signed-in profile.
 */
export const reportSchema = z.object({
  id: z.uuid('Invalid report id').optional(),
  title: z
    .string()
    .trim()
    .min(5, 'Enter a descriptive title (at least 5 characters)')
    .max(200, 'Title is too long'),
  summary: z.string().trim().max(4000, 'Summary is too long').optional(),
  outcomes: z.string().trim().max(4000, 'Outcomes are too long').optional(),
  attendance_count: z
    .number('Enter a number')
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(100000, 'That looks too large'),
  budget_spent: z
    .number('Enter a number')
    .min(0, 'Cannot be negative')
    .max(100000000, 'That looks too large'),
  liquidation_summary: z.string().trim().max(4000, 'Liquidation notes are too long').optional(),
  /** '' = no linked activity. */
  proposal_id: z.string().optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;
