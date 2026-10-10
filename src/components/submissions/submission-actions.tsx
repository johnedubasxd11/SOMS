'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  addSubmissionCommentAction,
  transitionSubmissionAction,
} from '@/lib/actions/submissions';
import { type ActionResult } from '@/lib/action-result';
import type { SubmissionPermissions } from '@/lib/submissions';
import type { SubmissionStatus } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const INITIAL: ActionResult = { ok: true };

interface StatusButton {
  label: string;
  to: SubmissionStatus;
  requiresRemarks: boolean;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function SubmissionActions({
  recordId,
  moduleKey,
  noun,
  permissions,
}: {
  recordId: string;
  moduleKey: string;
  /** "proposal" - keeps the action copy module specific. */
  noun: string;
  permissions: SubmissionPermissions;
}) {
  const [transitionState, transitionAction, transitionPending] = useActionState(
    transitionSubmissionAction,
    INITIAL
  );
  const [commentState, commentAction, commentPending] = useActionState(
    addSubmissionCommentAction,
    INITIAL
  );

  const [remarks, setRemarks] = useState('');
  const [comment, setComment] = useState('');
  const [handledTransition, setHandledTransition] = useState<ActionResult | null>(null);
  const [handledComment, setHandledComment] = useState<ActionResult | null>(null);
  const notifiedTransition = useRef<string | null>(null);
  const notifiedComment = useRef<string | null>(null);

  const buttons: StatusButton[] = [];
  if (permissions.canSubmit) {
    buttons.push({ label: 'Submit for review', to: 'submitted', requiresRemarks: false, variant: 'default' });
  }
  if (permissions.canWithdraw) {
    buttons.push({ label: 'Withdraw to draft', to: 'draft', requiresRemarks: false, variant: 'outline' });
  }
  if (permissions.canStartReview) {
    buttons.push({ label: 'Start review', to: 'under_review', requiresRemarks: false, variant: 'secondary' });
  }
  if (permissions.canDecide) {
    buttons.push({
      label:
        permissions.currentStepRole === 'adviser' ? `Endorse ${noun}` : 'Approve',
      to: 'approved',
      requiresRemarks: false,
      variant: 'default',
    });
    buttons.push({ label: 'Request revision', to: 'revision_requested', requiresRemarks: true, variant: 'secondary' });
    buttons.push({ label: 'Reject', to: 'rejected', requiresRemarks: true, variant: 'destructive' });
  }

  // Clearing local fields is internal state, so it happens during render
  // (React's "adjust state" pattern); toasts are external -> effect below.
  if (
    transitionState !== INITIAL &&
    transitionState !== handledTransition &&
    transitionState.ok
  ) {
    setHandledTransition(transitionState);
    setRemarks('');
  }

  if (commentState !== INITIAL && commentState !== handledComment && commentState.ok) {
    setHandledComment(commentState);
    setComment('');
  }

  useEffect(() => {
    if (transitionState === INITIAL) return;
    const key = JSON.stringify(transitionState);
    if (notifiedTransition.current === key) return;
    notifiedTransition.current = key;
    if (transitionState.ok) toast.success(transitionState.message ?? 'Updated.');
    else toast.error(transitionState.error);
  }, [transitionState]);

  useEffect(() => {
    if (commentState === INITIAL) return;
    const key = JSON.stringify(commentState);
    if (notifiedComment.current === key) return;
    notifiedComment.current = key;
    if (commentState.ok) toast.success(commentState.message ?? 'Remark posted.');
    else toast.error(commentState.error);
  }, [commentState]);

  function runStatusChange(button: StatusButton) {
    if (button.requiresRemarks && !remarks.trim()) {
      toast.error('Remarks are required for this action.');
      return;
    }
    const formData = new FormData();
    formData.set('id', recordId);
    formData.set('module', moduleKey);
    formData.set('to_status', button.to);
    formData.set('remarks', remarks.trim());
    startTransition(() => transitionAction(formData));
  }

  function postComment() {
    if (!comment.trim()) {
      toast.error('Write a remark before posting.');
      return;
    }
    const formData = new FormData();
    formData.set('id', recordId);
    formData.set('module', moduleKey);
    formData.set('remarks', comment.trim());
    startTransition(() => commentAction(formData));
  }

  if (buttons.length === 0 && !permissions.canComment) {
    return (
      <p className="text-sm text-muted-foreground">
        No actions are available for your account on this record.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {buttons.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder={
                permissions.canDecide
                  ? 'Explain the decision - required when rejecting or requesting a revision.'
                  : 'Optional note that is kept with this action.'
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {buttons.map((button) => (
              <Button
                key={button.to}
                type="button"
                size="sm"
                variant={button.variant ?? 'default'}
                disabled={transitionPending}
                onClick={() => runStatusChange(button)}
              >
                {transitionPending ? <Loader2 className="animate-spin" /> : <Send />}
                {button.label}
              </Button>
            ))}
          </div>

          {permissions.canDecide ? (
            <p className="text-xs text-muted-foreground">
              Decisions are recorded in the review log and sent to the next
              reviewer and the organization officers.
            </p>
          ) : null}
        </div>
      ) : null}

      {permissions.canComment ? (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="comment">Remark without a status change</Label>
          <Textarea
            id="comment"
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Ask the officers for a clarification…"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={commentPending}
            onClick={postComment}
          >
            {commentPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
            Post remark
          </Button>
        </div>
      ) : null}
    </div>
  );
}
