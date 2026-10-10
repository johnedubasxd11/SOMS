'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteRequirementAction,
  updateRequirementAction,
} from '@/lib/actions/requirements';
import type { ActionResult } from '@/lib/action-result';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const INITIAL: ActionResult = { ok: true };

/** Quick status moves for a requirement row (OSA only - RLS enforces too). */
export function RequirementRowActions({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateRequirementAction,
    INITIAL
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteRequirementAction,
    INITIAL
  );
  const [isDeleting, startDelete] = useTransition();
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!state || notified.current === JSON.stringify(state)) return;
    notified.current = JSON.stringify(state);
    toast[state.ok ? 'success' : 'error'](state.ok ? state.message ?? 'Updated.' : state.error);
  }, [state]);

  useEffect(() => {
    if (!deleteState.ok) {
      toast.error(deleteState.error);
      return;
    }
    if (deleteState.message) toast.success(deleteState.message);
  }, [deleteState]);

  function move(to: 'completed' | 'open' | 'waived') {
    const formData = new FormData();
    formData.set('id', id);
    formData.set('title', title);
    formData.set('status', to);
    formAction(formData);
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {status !== 'completed' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => move('completed')}
          title="Mark completed"
        >
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Complete
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => move('open')}
          title="Reopen"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Undo2 />} Reopen
        </Button>
      )}

      {status !== 'waived' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => move('waived')}
          title="Waive"
        >
          <RotateCcw /> Waive
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmDelete(true)}
        aria-label={`Delete ${title}`}
      >
        <Trash2 />
      </Button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this requirement?</DialogTitle>
            <DialogDescription>
              &quot;{title}&quot; will be removed for the organization. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deletePending || isDeleting}
            >
              Cancel
            </Button>
            <form
              action={() => {
                const formData = new FormData();
                formData.set('id', id);
                startDelete(() => deleteFormAction(formData));
              }}
              className="contents"
            >
              <Button
                type="submit"
                variant="destructive"
                disabled={deletePending || isDeleting}
              >
                {deletePending || isDeleting ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
