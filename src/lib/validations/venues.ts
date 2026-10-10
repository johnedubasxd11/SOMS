import { z } from 'zod';

/** OSA-maintained venue records (the canonical list on the proposal form). */
export const venueSchema = z.object({
  id: z.uuid('Invalid venue id').optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Venue name is required')
    .max(120, 'Name is too long'),
  location: z.string().trim().max(200, 'Location is too long').optional(),
  capacity: z
    .number('Enter a number')
    .int('Must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(100000, 'That looks too large')
    .optional(),
});

export type VenueInput = z.infer<typeof venueSchema>;

/** One candidate slot asked about by the proposal form. */
export const conflictQuerySchema = z.object({
  venue_id: z.uuid('Invalid venue id'),
  activity_date: z.iso.date('Activity date is required'),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use the format HH:MM')
    .optional(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use the format HH:MM')
    .optional(),
  exclude_id: z.uuid('Invalid proposal id').optional(),
});

export type ConflictQueryInput = z.infer<typeof conflictQuerySchema>;
