'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Send, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';

import { reviewOfficerTermAction } from '@/lib/actions/officer-terms';
import { type ActionResult } from '@/lib/action-result';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import {
  OFFICER_TERM_LABELS,
  OFFICER_TERM_TONE,
  type OfficerTermStatus,
} from '@/lib/labels';

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

  return { state, formAction, pending };
}

export interface TurnoverReviewRow {
  id: string;
  status: OfficerTermStatus;
  notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  organization_id: string;
  organization_name: string;
  members: { full_name: string; position: string; email: string | null }[];
}

function ReviewDialog({
  row,
  open,
  onOpenChange,
}: {
  row: TurnoverReviewRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction, pending } = useToastedAction(reviewOfficerTermAction);
  const lastResult = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  function submit(action: 'approve' | 'send_back') {
    const notes = (
      document.getElementById(`turnover-notes-${row.id}`) as HTMLTextAreaElement | null
    )?.value;
    const formData = new FormData();
    formData.set('id', row.id);
    formData.set('action', action);
    if (notes) formData.set('notes', notes);
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review officer list</DialogTitle>
          <DialogDescription>
            {row.organization_name} - {row.members.length} officer
            {row.members.length === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="divide-y rounded-lg border text-sm">
            {row.members.map((member, index) => (
              <li
                key={`${member.full_name}-${index}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="font-medium">{member.full_name}</span>
                <span className="text-muted-foreground">{member.position}</span>
              </li>
            ))}
          </ul>
          {row.notes ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              <span className="font-medium">Organization notes: </span>
              {row.notes}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`turnover-notes-${row.id}`}>
              Notes for the organization (required to send back)
            </Label>
            <Textarea
              id={`turnover-notes-${row.id}`}
              rows={3}
              placeholder="Please add the adviser's signature on page 2."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => submit('send_back')}
            data-testid="turnover-send-back"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            Send back
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => submit('approve')}
            data-testid="turnover-approve"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * OSA turnover queue (Phase 6): every submitted officer list, with the
 * member roster inline, and approve / send-back with notes.
 */
export function TurnoverReviewQueue({ rows }: { rows: TurnoverReviewRow[] }) {
  const [active, setActive] = useState<TurnoverReviewRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No officer lists are waiting for review.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{row.organization_name}</p>
              <p className="text-xs text-muted-foreground">
                {row.members.length} officer{row.members.length === 1 ? '' : 's'}
                {row.submitted_at ? ` - submitted ${formatDate(row.submitted_at)}` : ''}
              </p>
              {row.notes ? (
                <p className="text-xs text-muted-foreground">Notes: {row.notes}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={OFFICER_TERM_TONE[row.status]}>
                {OFFICER_TERM_LABELS[row.status]}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActive(row)}
                data-testid={`turnover-review-${row.organization_name}`}
              >
                <UserRoundCog className="size-3.5" />
                Review
              </Button>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {row.members.map((member, index) => (
              <li key={`${member.full_name}-${index}`}>
                <span className="font-medium text-foreground">{member.full_name}</span>
                {' - '}
                {member.position}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {active ? (
        <ReviewDialog
          row={active}
          open
          onOpenChange={(open) => {
            if (!open) setActive(null);
          }}
        />
      ) : null}
    </div>
  );
}
