'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import {
  createRequirementAction,
  updateRequirementAction,
} from '@/lib/actions/requirements';
import type { ActionResult } from '@/lib/action-result';
import { REQUIREMENT_VALUES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const INITIAL: ActionResult = { ok: true };

export interface OrgOption {
  id: string;
  code: string;
  name: string;
}

export interface RequirementRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: (typeof REQUIREMENT_VALUES)[number];
}

/**
 * OSA create + edit dialog for requirements. Client-side validation is the
 * same zod schema the server action runs, so bad input is caught twice.
 */
export function RequirementForm({
  organizations,
  row,
}: {
  organizations: OrgOption[];
  /** Present = edit mode for this row; absent = create mode. */
  row?: RequirementRow;
}) {
  const [open, setOpen] = useState(false);
  const action = row ? updateRequirementAction : createRequirementAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [handled, setHandled] = useState<ActionResult | null>(null);
  const notified = useRef<ActionResult | null>(null);

  const [organizationId, setOrganizationId] = useState(row?.organization_id ?? '');
  const [status, setStatus] = useState<string>(row?.status ?? 'open');

  // Render-phase adjustment (React's "adjust state during render" pattern):
  // close the dialog after a successful submit, no effect needed.
  if (state !== INITIAL && state !== handled) {
    setHandled(state);
    if (state.ok) setOpen(false);
  }

  // Toasts talk to an external system, which is what effects are for.
  useEffect(() => {
    if (state === INITIAL || notified.current === state) return;
    notified.current = state;
    toast[state.ok ? 'success' : 'error'](
      state.ok ? state.message ?? 'Saved.' : state.error
    );
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {row ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${row.title}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New requirement
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? 'Edit requirement' : 'New requirement'}</DialogTitle>
          <DialogDescription>
            Assigned organizations see it immediately and receive a
            notification. Due-soon reminders go out daily.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {row ? <input type="hidden" name="id" value={row.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor={`${row?.id ?? 'new'}-org`}>Organization</Label>
            <Select
              value={organizationId}
              onValueChange={setOrganizationId}
              disabled={Boolean(row)}
            >
              <SelectTrigger id={`${row?.id ?? 'new'}-org`}>
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.code} - {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="organization_id" value={organizationId} />
            {row ? (
              <p className="text-xs text-muted-foreground">
                The organization cannot be changed after assignment.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${row?.id ?? 'new'}-title`}>Title</Label>
            <Input
              id={`${row?.id ?? 'new'}-title`}
              name="title"
              defaultValue={row?.title ?? ''}
              placeholder="e.g. Signed attendance sheet"
              required
              minLength={3}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${row?.id ?? 'new'}-desc`}>Details (optional)</Label>
            <Textarea
              id={`${row?.id ?? 'new'}-desc`}
              name="description"
              defaultValue={row?.description ?? ''}
              rows={3}
              maxLength={2000}
              placeholder="What exactly must be submitted, and where?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${row?.id ?? 'new'}-due`}>Due date (optional)</Label>
              <Input
                id={`${row?.id ?? 'new'}-due`}
                type="date"
                name="due_date"
                defaultValue={row?.due_date ?? ''}
              />
            </div>

            {row ? (
              <div className="space-y-2">
                <Label htmlFor={`${row?.id ?? 'new'}-status`}>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id={`${row?.id ?? 'new'}-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === 'open'
                          ? 'Open'
                          : value === 'completed'
                            ? 'Completed'
                            : value === 'overdue'
                              ? 'Overdue'
                              : 'Waived'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={status} />
              </div>
            ) : null}
          </div>

          {handled && !handled.ok ? (
            <p className="text-sm text-destructive">{handled.error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !organizationId}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {row ? 'Save changes' : 'Assign requirement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
