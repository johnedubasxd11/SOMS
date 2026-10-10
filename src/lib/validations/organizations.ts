import { z } from 'zod';

export const ACCREDITATION_STATUSES = [
  'pending',
  'accredited',
  'conditional',
  'not_accredited',
] as const;

export const ACCREDITATION_LABELS: Record<(typeof ACCREDITATION_STATUSES)[number], string> = {
  pending: 'Pending',
  accredited: 'Accredited',
  conditional: 'Conditional',
  not_accredited: 'Not Accredited',
};

export const updateOrganizationSchema = z.object({
  id: z.uuid('Invalid organization id'),
  description: z.string().trim().max(1000, 'Description is too long').optional(),
  accreditation_status: z.enum(ACCREDITATION_STATUSES),
  accreditation_valid_until: z
    .union([z.literal(''), z.iso.date('Use the format YYYY-MM-DD')])
    .optional(),
  membership_count: z
    .number('Enter a number')
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),
  is_active: z.boolean(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const createSchoolYearSchema = z
  .object({
    name: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Use the format 2026-2027'),
    start_date: z.iso.date('Start date is required'),
    end_date: z.iso.date('End date is required'),
    is_current: z.boolean(),
  })
  .refine((data) => data.end_date > data.start_date, {
    path: ['end_date'],
    message: 'End date must be after the start date',
  });

export type CreateSchoolYearInput = z.infer<typeof createSchoolYearSchema>;
