'use client';

import { useActionState, useEffect, useRef, startTransition, useState } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { updateApprovalChainAction } from '@/lib/actions/approval-chains';
import { type ActionResult } from '@/lib/action-result';
import {
  APPROVAL_STEP_ROLE_LABELS,
  type ApprovalStepRole,
} from '@/lib/labels';
import { APPROVAL_STEP_ROLES } from '@/lib/validations/approval-chains';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from 'cn';

const INITIAL: ActionResult = { ok: true };

/**
 * Client editor for one chain: an ordered list of step roles. Saving replaces
 * the steps wholesale (numbers are re-sequenced on save).
 */
export function ApprovalChainEditor({
  chainId,
  initialSteps,
}: {
  chainId: string;
  initialSteps: ApprovalStepRole[];
}) {
  const [state, formAction, pending] = useActionState(
    updateApprovalChainAction,
    INITIAL
  );
  const [handledState, setHandledState] = useState<ActionResult | null>(null);
  const notified = useRef<string | null>(null);

  const [steps, setSteps] = useState<ApprovalStepRole[]>(initialSteps);

  if (state !== INITIAL && state !== handledState && state.ok) {
    setHandledState(state);
  }

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Approval chain saved.');
    else toast.error(state.error);
  }, [state]);

  function setRole(index: number, role: ApprovalStepRole) {
    setSteps((current) => current.map((entry, i) => (i === index ? role : entry)));
  }

  function addStep() {
    setSteps((current) =>
      current.length >= 6 ? current : [...current, 'osa_admin']
    );
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index));
  }

  function save() {
    const formData = new FormData();
    formData.set('chain_id', chainId);
    formData.set('step_roles', steps.join(','));
    startTransition(() => formAction(formData));
  }

  const dirty = steps.join(',') !== initialSteps.join(',');

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {steps.map((role, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                'border-border bg-muted text-muted-foreground'
              )}
            >
              {index + 1}
            </span>
            <Select value={role} onValueChange={(value) => setRole(index, value as ApprovalStepRole)}>
              <SelectTrigger className="h-8 w-56" aria-label={`Step ${index + 1} role`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_STEP_ROLES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {APPROVAL_STEP_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={steps.length <= 1 || pending}
              onClick={() => removeStep(index)}
              aria-label={`Remove step ${index + 1}`}
            >
              <X />
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          disabled={steps.length >= 6 || pending}
        >
          <Plus /> Add step
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!dirty || pending || steps.length === 0}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save chain
        </Button>
        {steps.length === 1 && steps[0] === 'osa_admin' ? (
          <p className="text-xs text-muted-foreground">
            Single step: officers submit straight to OSA.
          </p>
        ) : null}
      </div>
    </div>
  );
}
