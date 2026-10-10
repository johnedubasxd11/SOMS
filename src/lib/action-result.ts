/** Uniform result contract for the Phase 2 server actions. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export function ok(message?: string): ActionResult {
  return { ok: true, message };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

export function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'Invalid input';
}
