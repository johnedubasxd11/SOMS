'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Loader2, Pin, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  createAnnouncementAction,
  deleteAnnouncementAction,
} from '@/lib/actions/announcements';
import { type ActionResult } from '@/lib/action-result';
import { ANNOUNCEMENT_TARGET_LABELS, type AnnouncementTargetType } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const INITIAL: ActionResult = { ok: true };

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  target_type: AnnouncementTargetType;
  is_pinned: boolean;
  expires_at: string | null;
  attachment_file_name: string | null;
  created_at: string;
}

export interface AnnouncementTargetOption {
  id: string;
  label: string;
}

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

function ComposerDialog({
  open,
  onOpenChange,
  colleges,
  organizations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colleges: AnnouncementTargetOption[];
  organizations: AnnouncementTargetOption[];
}) {
  const { state, formAction, pending } = useToastedAction(createAnnouncementAction);
  const lastResult = useRef<ActionResult | null>(null);
  const [targetType, setTargetType] = useState<AnnouncementTargetType>('all');

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post announcement</DialogTitle>
          <DialogDescription>
            Everyone targeted receives an in-app notification the moment you
            post.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => {
            startTransition(() => formAction(data));
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              name="title"
              required
              placeholder="OSA Advisory: Accreditation deadline"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-body">Body</Label>
            <Textarea
              id="announcement-body"
              name="body"
              rows={4}
              required
              placeholder="All organizations must submit..."
            />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select
              value={targetType}
              onValueChange={(value) => setTargetType(value as AnnouncementTargetType)}
            >
              <SelectTrigger aria-label="Announcement audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['all', 'college', 'organization'] as AnnouncementTargetType[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {ANNOUNCEMENT_TARGET_LABELS[value]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <input type="hidden" name="target_type" value={targetType} />
          </div>
          {targetType === 'college' ? (
            <div className="space-y-2">
              <Label>College</Label>
              <Select name="college_id">
                <SelectTrigger aria-label="Target college">
                  <SelectValue placeholder="Pick a college" />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id}>
                      {college.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {targetType === 'organization' ? (
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select name="organization_id">
                <SelectTrigger aria-label="Target organization">
                  <SelectValue placeholder="Pick an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-expires">Expires (optional)</Label>
              <Input
                id="announcement-expires"
                name="expires_at"
                type="datetime-local"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-attachment">Attachment (optional)</Label>
              <Input
                id="announcement-attachment"
                name="attachment"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_pinned" className="size-4" />
            <Pin className="size-3.5" /> Pin to the top of the board
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              Post announcement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id }: { id: string }) {
  const { formAction, pending } = useToastedAction(deleteAnnouncementAction);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Delete announcement"
        disabled={pending}
        onClick={() => {
          if (confirmDelete) {
            const data = new FormData();
            data.set('id', id);
            startTransition(() => formAction(data));
            setConfirmDelete(false);
          } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
          }
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
      {confirmDelete ? (
        <p className="text-xs text-destructive">Click again to delete</p>
      ) : null}
    </div>
  );
}

export function AnnouncementBoard({
  announcements,
  isOsa,
  colleges,
  organizations,
}: {
  announcements: AnnouncementRow[];
  isOsa: boolean;
  colleges: AnnouncementTargetOption[];
  organizations: AnnouncementTargetOption[];
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      {isOsa ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {announcements.length} announcement
            {announcements.length === 1 ? '' : 's'} on the board
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> Post announcement
          </Button>
        </div>
      ) : null}

      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No announcements yet - check back with OSA.
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((row) => {
            const expired = row.expires_at !== null && new Date(row.expires_at) < new Date();
            return (
              <article
                key={row.id}
                className={`rounded-lg border p-4 ${row.is_pinned ? 'border-primary/40 bg-primary/5' : ''} ${expired ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{row.title}</h2>
                      {row.is_pinned ? (
                        <Badge variant="secondary">
                          <Pin className="size-3" /> Pinned
                        </Badge>
                      ) : null}
                      <Badge variant="outline">
                        {ANNOUNCEMENT_TARGET_LABELS[row.target_type]}
                      </Badge>
                      {expired ? <Badge variant="destructive">Expired</Badge> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {row.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Posted {formatDateTime(row.created_at)}
                      {row.expires_at
                        ? ` · expires ${formatDateTime(row.expires_at)}`
                        : ''}
                      {row.attachment_file_name ? (
                        <>
                          {' · '}
                          <a
                            href={`/api/announcements/${row.id}/file`}
                            className="hover:underline"
                          >
                            {row.attachment_file_name}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {isOsa ? <DeleteButton id={row.id} /> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isOsa ? (
        <ComposerDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          colleges={colleges}
          organizations={organizations}
        />
      ) : null}
    </div>
  );
}
