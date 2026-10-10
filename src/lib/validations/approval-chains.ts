import { z } from 'zod';

export const APPROVAL_STEP_ROLES = ['adviser', 'dean', 'osa_admin'] as const;

/**
 * The editor sends the chain as a comma separated list of step roles in
 * order ("adviser,dean,osa_admin") - step numbers are assigned on save.
 */
export const updateApprovalChainSchema = z.object({
  chain_id: z.uuid('Invalid chain id'),
  step_roles: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(z.enum(APPROVAL_STEP_ROLES))
        .min(1, 'The chain needs at least one step')
        .max(6, 'A chain may have at most 6 steps')
    ),
});

export type UpdateApprovalChainInput = z.infer<typeof updateApprovalChainSchema>;
