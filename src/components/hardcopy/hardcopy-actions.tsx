'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, Printer, QrCode } from 'lucide-react';
import { toast } from 'sonner';

import { markHardcopyReceivedAction } from '@/lib/actions/hardcopy';
import { type ActionResult } from '@/lib/action-result';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const INITIAL: ActionResult = { ok: true };

export interface HardcopyRowAction {
  recordType: string;
  recordId: string;
  referenceNumber: string;
  title: string;
  organizationName: string;
  moduleLabel: string;
  received: boolean;
  receivedAt: string | null;
  receiverName: string | null;
}

/**
 * Row actions of the hardcopy tracker: log the paper copy (OSA, through the
 * `mark_hardcopy_received()` RPC) and print the QR cover sheet of the folder.
 */
export function HardcopyActions({ record }: { record: HardcopyRowAction }) {
  const [coverOpen, setCoverOpen] = useState(false);
  const qrSrc = `/api/qr/${record.recordType}/${record.recordId}`;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setCoverOpen(true)}>
        <QrCode /> Cover sheet
      </Button>

      {!record.received ? <MarkReceivedDialog record={record} /> : null}

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="print:hidden">
            <DialogTitle>Cover sheet</DialogTitle>
            <DialogDescription>
              Print this sheet and keep it with the paper copy.
            </DialogDescription>
          </DialogHeader>

          <div id="cover-sheet" className="space-y-5 text-center">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Assumption College of Davao
              </p>
              <p className="text-sm font-medium">
                Office of Student Affairs - {record.moduleLabel}
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-mono text-sm font-semibold">
                {record.referenceNumber}
              </p>
              <p className="text-base font-semibold">{record.title}</p>
              <p className="text-sm text-muted-foreground">
                {record.organizationName}
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`QR code for ${record.referenceNumber}`}
              width={220}
              height={220}
              className="mx-auto size-[220px] rounded-lg bg-white p-2"
            />
            <p className="text-xs text-muted-foreground">
              Scan to open the digital record of this submission.
            </p>

            {record.received ? (
              <p className="text-xs text-muted-foreground">
                Hardcopy received: {formatDateTime(record.receivedAt)}
                {record.receiverName ? ` · ${record.receiverName}` : ''}
              </p>
            ) : null}
          </div>

          <DialogFooter className="print:hidden">
            <Button type="button" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarkReceivedDialog({ record }: { record: HardcopyRowAction }) {
  const [state, formAction, pending] = useActionState(
    markHardcopyReceivedAction,
    INITIAL
  );
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Hardcopy received.');
    else toast.error(state.error);
  }, [state]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('record_type', record.recordType);
    formData.set('record_id', record.recordId);
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Log receipt</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log hardcopy receipt</DialogTitle>
          <DialogDescription>
            {record.referenceNumber} - {record.title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`receiver-${record.recordId}`}>Received from</Label>
            <Input
              id={`receiver-${record.recordId}`}
              name="receiver_name"
              required
              minLength={2}
              maxLength={200}
              placeholder="Name of the person who handed the paper copy"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`remarks-${record.recordId}`}>Remarks (optional)</Label>
            <Textarea
              id={`remarks-${record.recordId}`}
              name="remarks"
              rows={2}
              maxLength={1000}
              placeholder="Complete set, 3 copies…"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Mark as received
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
