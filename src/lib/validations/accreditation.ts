import { z } from 'zod';

/** OSA checklist item fields (per school year). */
export const accreditationItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(1000).optional(),
  sort_order: z.coerce
    .number('Enter a number')
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(999),
  is_required: z.boolean(),
});

export type AccreditationItemInput = z.infer<typeof accreditationItemSchema>;

/** OSA review of one organization's upload. */
export const accreditationReviewSchema = z
  .object({
    id: z.uuid('Invalid submission id'),
    status: z.enum(['approved', 'rejected']),
    remarks: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => data.status !== 'rejected' || (data.remarks?.length ?? 0) > 0,
    {
      path: ['remarks'],
      message: 'Remarks are required when rejecting an upload',
    }
  );

export type AccreditationReviewInput = z.infer<typeof accreditationReviewSchema>;
