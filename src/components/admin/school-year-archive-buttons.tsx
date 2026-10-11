'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Loader2, Sunrise } from 'lucide-react';
import { toast } from 'sonner';

import {
  rolloverSchoolYearAction,
  setSchoolYearArchivedAction,
} from '@/lib/actions/school-years';
import { type ActionResult } from '@/lib/action-result';
import { Button } from '@/components/ui/button';

const INITIAL: ActionResult = { ok: true };

function useToastedAction(
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>
) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  return { formAction, pending };
}

export function ArchiveSchoolYearButton({
  id,
  name,
  isCurrent,
  isArchived,
}: {
  id: string;
  name: string;
  isCurrent: boolean;
  isArchived: boolean;
}) {
  const { formAction, pending } = useToastedAction(setSchoolYearArchivedAction);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (isCurrent) {
    return (
      <span className="text-xs text-muted-foreground" title="Make another year current first">
        Cannot archive (current)
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      className={isArchived ? undefined : 'text-destructive hover:text-destructive'}
      data-testid={`school-year-archive-${name}`}
      onClick={() => {
        if (!isArchived && !armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        const formData = new FormData();
        formData.set('id', id);
        formData.set('archived', isArchived ? 'off' : 'on');
        startTransition(() => formAction(formData));
        setArmed(false);
      }}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isArchived ? (
        <ArchiveRestore className="size-3.5" />
      ) : (
        <Archive className="size-3.5" />
      )}
      {armed ? 'Confirm archive' : isArchived ? 'Restore' : 'Archive'}
    </Button>
  );
}

export function RolloverSchoolYearButton({ hasCurrent }: { hasCurrent: boolean }) {
  const { formAction, pending } = useToastedAction(rolloverSchoolYearAction);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form
      action={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        startTransition(() => formAction(new FormData()));
        setArmed(false);
      }}
      className="inline-flex"
    >
      <Button
        type="submit"
        size="sm"
        disabled={pending || !hasCurrent}
        data-testid="school-year-rollover"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sunrise />}
        {armed ? 'Confirm rollover' : 'Rollover to next year'}
      </Button>
    </form>
  );
}
