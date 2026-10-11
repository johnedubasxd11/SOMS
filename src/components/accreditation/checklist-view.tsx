'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteAccreditationSubmissionAction,
  uploadAccreditationAction,
} from '@/lib/actions/accreditation';
import { type ActionResult } from '@/lib/action-result';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ACCREDITATION_SUBMISSION_LABELS,
  ACCREDITATION_SUBMISSION_TONE,
  type AccreditationSubmissionStatus,
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

  return { formAction, pending };
}

export interface ChecklistItemRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  submission: {
    id: string;
    status: AccreditationSubmissionStatus;
    file_name: string;
    remarks: string | null;
  } | null;
}

function UploadCell({ item }: { item: ChecklistItemRow }) {
  const { formAction, pending } = useToastedAction(uploadAccreditationAction);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const frozen = item.submission?.status === 'approved';

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Choose a file first.');
      return;
    }
    const formData = new FormData();
    formData.set('item_id', item.id);
    formData.set('file', file);
    startTransition(() => formAction(formData));
  }

  if (frozen) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a
          href={`/api/accreditation/${item.submission!.id}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <Download className="size-3.5" />
          {item.submission!.file_name}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        data-testid={`accreditation-file-${item.id}`}
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        data-testid={`accreditation-pick-${item.id}`}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
        {item.submission ? 'Replace file' : 'Upload file'}
      </Button>
      {fileName ? (
        <span className="max-w-40 truncate text-xs text-muted-foreground">{fileName}</span>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={pending || !fileName}
        onClick={submit}
        data-testid={`accreditation-submit-${item.id}`}
      >
        Submit
      </Button>
      {item.submission ? (
        <a
          href={`/api/accreditation/${item.submission.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <Download className="size-3" />
          Current
        </a>
      ) : null}
    </div>
  );
}

function RemoveButton({ submissionId }: { submissionId: string }) {
  const { formAction, pending } = useToastedAction(
    deleteAccreditationSubmissionAction
  );
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        const formData = new FormData();
        formData.set('id', submissionId);
        startTransition(() => formAction(formData));
        setArmed(false);
      }}
    >
      <Trash2 className="size-3.5" />
      {armed ? 'Confirm remove' : 'Remove'}
    </Button>
  );
}

/**
 * The organization-facing checklist (Phase 6): every item OSA defined for
 * the current school year, the org's own upload state per item, and the
 * upload / replace / remove controls while the row is not yet approved.
 */
export function ChecklistView({ items }: { items: ChecklistItemRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No accreditation items yet - OSA publishes the checklist for this school year.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border p-4"
          data-testid={`accreditation-item-${item.title}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {item.title}
                {item.is_required ? (
                  <span className="ml-1 text-destructive" aria-hidden>
                    *
                  </span>
                ) : null}
              </p>
              {item.description ? (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              ) : null}
              {item.submission?.remarks ? (
                <p className="text-xs text-destructive">
                  OSA remarks: {item.submission.remarks}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {item.submission ? (
                <Badge
                  variant="outline"
                  className={ACCREDITATION_SUBMISSION_TONE[item.submission.status]}
                  data-testid={`accreditation-status-${item.title}`}
                >
                  {ACCREDITATION_SUBMISSION_LABELS[item.submission.status]}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Not uploaded
                </Badge>
              )}
              {item.submission && item.submission.status !== 'approved' ? (
                <RemoveButton submissionId={item.submission.id} />
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            <UploadCell item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}
