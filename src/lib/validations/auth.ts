import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid e-mail address'),
  password: z.string().min(1, 'Password is required'),
  // Path the user originally asked for (set by src/proxy.ts).
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
