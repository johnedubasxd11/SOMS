import { z } from 'zod';

export const USER_ROLES = [
  'super_admin',
  'osa_admin',
  'dean',
  'adviser',
  'officer',
] as const;

function requireOrganization(
  data: { role: string; organization_id?: string; college_id?: string },
  ctx: z.RefinementCtx
) {
  if (
    (data.role === 'adviser' || data.role === 'officer') &&
    !data.organization_id
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['organization_id'],
      message: 'Pick an organization for advisers and officers',
    });
  }
  if (data.role === 'dean' && !data.college_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['college_id'],
      message: 'Pick a college for deans',
    });
  }
}

export const createUserSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Full name is required')
      .max(120, 'Full name is too long'),
    email: z.email('Enter a valid e-mail address').max(160),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Password is too long'),
    role: z.enum(USER_ROLES),
    organization_id: z.string().trim().optional(),
    college_id: z.string().trim().optional(),
    position: z.string().trim().max(80).optional(),
  })
  .superRefine(requireOrganization);

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    id: z.uuid('Invalid user id'),
    full_name: z
      .string()
      .trim()
      .min(2, 'Full name is required')
      .max(120, 'Full name is too long'),
    role: z.enum(USER_ROLES),
    organization_id: z.string().trim().optional(),
    college_id: z.string().trim().optional(),
    position: z.string().trim().max(80).optional(),
    is_active: z.boolean(),
  })
  .superRefine(requireOrganization);

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Super-admin password reset (same policy as createUserSchema). */
export const resetPasswordSchema = z.object({
  id: z.uuid('Invalid user id'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(128, 'Password is too long'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
