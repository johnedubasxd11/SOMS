import { z } from 'zod';

export const officerTermMemberSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  position: z.string().trim().min(1, 'Position is required').max(100),
  email: z
    .union([z.literal(''), z.email('Enter a valid e-mail')])
    .optional(),
});

/** One organization's officer list for a school year (the draft the officers edit). */
export const officerTermSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  members: z
    .array(officerTermMemberSchema)
    .min(1, 'List at least one officer')
    .max(50, 'A list may not carry more than 50 officers'),
});

export type OfficerTermInput = z.infer<typeof officerTermSchema>;
export type OfficerTermMemberInput = z.infer<typeof officerTermMemberSchema>;

/** OSA decision on a submitted officer list. */
export const officerTermReviewSchema = z
  .object({
    id: z.uuid('Invalid turnover id'),
    action: z.enum(['approve', 'send_back']),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.action !== 'send_back' || (data.notes?.length ?? 0) > 0, {
    path: ['notes'],
    message: 'Notes are required when sending the list back',
  });

export type OfficerTermReviewInput = z.infer<typeof officerTermReviewSchema>;
