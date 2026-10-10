import { z } from 'zod';

/** Self-service edits: only fields the profile guard lets users change themselves. */
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Full name is required')
    .max(120, 'Full name is too long'),
  position: z.string().trim().max(80, 'Position is too long').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Same password policy as createUserSchema. */
export const changePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Password is too long'),
    confirm: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
