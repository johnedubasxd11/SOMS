import { z } from 'zod';

import { REQUIREMENT_VALUES } from '@/lib/labels';

const title = z
  .string()
  .trim()
  .min(3, 'Enter a title (at least 3 characters)')
  .max(200, 'Title is too long');

const description = z.string().trim().max(2000, 'Description is too long').optional();

const dueDate = z.union([
  z.literal(''),
  z.iso.date('Use the format YYYY-MM-DD'),
]);

/** OSA creates a requirement for any organization + current school year. */
export const createRequirementSchema = z.object({
  organization_id: z.uuid('Select an organization'),
  title,
  description,
  due_date: dueDate.optional(),
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

/** OSA edits the wording/due date and moves the status along. */
export const updateRequirementSchema = z.object({
  id: z.uuid('Invalid requirement id'),
  title,
  description,
  due_date: dueDate.optional(),
  status: z.enum(REQUIREMENT_VALUES),
});

export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
