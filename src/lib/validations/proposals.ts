import { z } from 'zod';

const timeValue = z.union([
  z.literal(''),
  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use the format HH:MM'),
]);

/**
 * Activity fields only - organization and school year are derived server-side
 * from the signed-in profile, so a form post can never attach a proposal to
 * somebody else's organization.
 */
export const proposalSchema = z
  .object({
    id: z.uuid('Invalid proposal id').optional(),
    title: z
      .string()
      .trim()
      .min(5, 'Enter a descriptive title (at least 5 characters)')
      .max(200, 'Title is too long'),
    description: z.string().trim().max(2000, 'Description is too long').optional(),
    objectives: z.string().trim().max(2000, 'Objectives are too long').optional(),
    activity_date: z.iso.date('Activity date is required'),
    start_time: timeValue.optional(),
    end_time: timeValue.optional(),
    venue: z.string().trim().min(3, 'Venue is required').max(200, 'Venue is too long'),
    /**
     * Canonical venue from the `venues` list - empty means "off campus /
     * typed by hand", in which case no conflict check applies.
     */
    venue_id: z.uuid('Pick a venue from the list').optional(),
    participants_count: z
      .number('Enter a number')
      .int('Must be a whole number')
      .min(0, 'Cannot be negative')
      .max(100000, 'That looks too large'),
    budget: z
      .number('Enter a number')
      .min(0, 'Cannot be negative')
      .max(100000000, 'That looks too large'),
    source_of_funds: z.string().trim().max(200, 'Source of funds is too long').optional(),
  })
  .refine(
    (data) =>
      !data.start_time ||
      !data.end_time ||
      data.end_time.slice(0, 5) > data.start_time.slice(0, 5),
    { path: ['end_time'], message: 'End time must be after the start time' }
  );

export type ProposalInput = z.infer<typeof proposalSchema>;
