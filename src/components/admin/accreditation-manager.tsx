'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  createAccreditationItemAction,
  deleteAccreditationItemAction,
  reviewAccreditationAction,
  updateAccreditationItemAction,
} from '@/lib/actions/accreditation';
import { type ActionResult } from '@/lib/action-result';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  ACCREDITATION_SUBMISSION_LABELS,
  ACCREDITATION_SUBMISSION_TONE,
  type AccreditationSubmissionStatus,
} from '@/lib/labels';
import { formatDate } from '@/lib/format';

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

export interface ItemRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  upload_count: number;
  pending_count: number;
}

export interface ReviewRow {
  id: string;
  status: AccreditationSubmissionStatus;
  file_name: string;
  remarks: string | null;
  submitted_at: string;
  organization_id: string;
  organization_name: string;
  item_title: string;
}

function ItemDialog({
  mode,
  item,
  schoolYearId,
  open,
  onOpenChange,
}: {
  mode: 'create' | 'edit';
  item?: ItemRow | null;
  schoolYearId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = mode === 'create' ? createAccreditationItemAction : updateAccreditationItemAction;
  const { state, formAction, pending } = useToastedAction(action);
  const lastResult = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add checklist item' : 'Edit checklist item'}</DialogTitle>
          <DialogDescription>
            Every organization sees this item on their accreditation checklist and
            uploads one file for it.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => {
            startTransition(() => formAction(data));
          }}
          className="space-y-4"
        >
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <input type="hidden" name="school_year_id" value={schoolYearId} />
          <div className="space-y-2">
            <Label htmlFor={`item-title-${mode}`}>Title</Label>
            <Input
              id={`item-title-${mode}`}
              name="title"
              required
              defaultValue={item?.title ?? ''}
              placeholder="Constitution and By-Laws"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`item-description-${mode}`}>Description (optional)</Label>
            <Textarea
              id={`item-description-${mode}`}
              name="description"
              defaultValue={item?.description ?? ''}
              placeholder="Notarized constitution and by-laws of the organization"
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`item-sort-${mode}`}>Sort order</Label>
              <Input
                id={`item-sort-${mode}`}
                name="sort_order"
                type="number"
                min={0}
                defaultValue={item?.sort_order ?? 0}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input type="hidden" name="is_required" value="off" />
              <input
                id={`item-required-${mode}`}
                name="is_required"
                type="checkbox"
                defaultChecked={item?.is_required ?? true}
                className="size-4 accent-primary"
              />
              <Label htmlFor={`item-required-${mode}`} className="font-normal">
                Required
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : mode === 'create' ? <Plus /> : <Pencil />}
              {mode === 'create' ? 'Add item' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemButton({ itemId }: { itemId: string }) {
  const { formAction, pending } = useToastedAction(deleteAccreditationItemAction);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      aria-label="Delete checklist item"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        const formData = new FormData();
        formData.set('id', itemId);
        startTransition(() => formAction(formData));
        setArmed(false);
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function ReviewDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ReviewRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction, pending } = useToastedAction(reviewAccreditationAction);
  const lastResult = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  function submit(status: 'approved' | 'rejected') {
    const formData = new FormData();
    formData.set('id', row.id);
    formData.set('status', status);
    const remarks = (
      document.getElementById(`review-remarks-${row.id}`) as HTMLTextAreaElement | null
    )?.value;
    if (remarks) formData.set('remarks', remarks);
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review upload</DialogTitle>
          <DialogDescription>
            {row.organization_name} - {row.item_title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <a
            href={`/api/accreditation/${row.id}`}
            className="inline-flex items-center gap-1 text-sm hover:underline"
          >
            <Download className="size-4" />
            {row.file_name}
          </a>
          <div className="space-y-2">
            <Label htmlFor={`review-remarks-${row.id}`}>Remarks (required to reject)</Label>
            <Textarea
              id={`review-remarks-${row.id}`}
              rows={3}
              defaultValue={row.remarks ?? ''}
              placeholder="Illegible scan - please re-upload the notarized copy."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => submit('rejected')}
            data-testid="accreditation-reject"
          >
            {pending ? <Loader2 className="animate-spin" /> : <X />}
            Reject
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => submit('approved')}
            data-testid="accreditation-approve"
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
 * OSA accreditation screen (Phase 6): manage the per-year checklist and
 * approve / reject each organization's upload. The organization's final
 * accreditation status stays on the organization record (/organizations).
 */
export function AccreditationManager({
  schoolYearId,
  items,
  reviews,
}: {
  schoolYearId: string;
  items: ItemRow[];
  reviews: ReviewRow[];
}) {
  const [itemDialog, setItemDialog] = useState<{
    mode: 'create' | 'edit';
    item?: ItemRow;
  } | null>(null);
  const [reviewRow, setReviewRow] = useState<ReviewRow | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">Checklist items</h2>
            <p className="text-xs text-muted-foreground">
              One file per organization per item.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setItemDialog({ mode: 'create' })}
            data-testid="accreditation-add-item"
          >
            <Plus />
            Add item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Required</th>
                <th className="px-4 py-2 text-right">Uploads</th>
                <th className="px-4 py-2 text-right">Pending</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No checklist items for this school year yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{item.title}</span>
                      {item.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      {item.is_required ? (
                        <Badge variant="outline">Required</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Optional</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{item.upload_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{item.pending_count}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit checklist item"
                          onClick={() => setItemDialog({ mode: 'edit', item })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <DeleteItemButton itemId={item.id} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">Uploads to review</h2>
          <p className="text-xs text-muted-foreground">
            Approved rows freeze for the organization; rejected rows can be re-uploaded.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Submitted</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No uploads yet.
                  </td>
                </tr>
              ) : (
                reviews.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-medium">{row.organization_name}</td>
                    <td className="px-4 py-2">{row.item_title}</td>
                    <td className="px-4 py-2">
                      <a
                        href={`/api/accreditation/${row.id}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <Download className="size-3.5" />
                        <span className="max-w-40 truncate">{row.file_name}</span>
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={ACCREDITATION_SUBMISSION_TONE[row.status]}
                      >
                        {ACCREDITATION_SUBMISSION_LABELS[row.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.submitted_at)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewRow(row)}
                        data-testid={`accreditation-review-${row.id}`}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {itemDialog ? (
        <ItemDialog
          mode={itemDialog.mode}
          item={itemDialog.item}
          schoolYearId={schoolYearId}
          open
          onOpenChange={(open) => {
            if (!open) setItemDialog(null);
          }}
        />
      ) : null}
      {reviewRow ? (
        <ReviewDialog
          row={reviewRow}
          open
          onOpenChange={(open) => {
            if (!open) setReviewRow(null);
          }}
        />
      ) : null}
    </div>
  );
}
