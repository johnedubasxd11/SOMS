'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { setCurrentSchoolYearAction } from '@/lib/actions/school-years';
import { type ActionResult } from '@/lib/action-result';

const INITIAL: ActionResult = { ok: true };

export function SetCurrentSchoolYearButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(
    setCurrentSchoolYearAction,
    INITIAL
  );
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Make current'}
      </button>
    </form>
  );
}
