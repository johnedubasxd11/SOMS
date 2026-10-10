'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Download, History, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteTemplateAction,
  replaceTemplateAction,
  uploadTemplateAction,
} from '@/lib/actions/templates';
import { type ActionResult } from '@/lib/action-result';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS, type TemplateCategory } from '@/lib/labels';
import { formatBytes, formatDate } from '@/lib/format';
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

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  file_name: string;
  size_bytes: number;
  version: number;
  is_active: boolean;
  parent_id: string | null;
  created_at: string;
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

function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction, pending } = useToastedAction(uploadTemplateAction);
  const lastResult = useRef<ActionResult | null>(null);
  const [category, setCategory] = useState<TemplateCategory>('other');

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload template</DialogTitle>
          <DialogDescription>
            Blank forms every organization downloads. A new upload of the same
            name supersedes the old version - nothing is overwritten.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => {
            data.set('category', category);
            startTransition(() => formAction(data));
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              name="name"
              required
              placeholder="Activity Proposal Form"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              name="description"
              rows={2}
              placeholder="Fillable PDF used for all activity proposals."
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as TemplateCategory)}>
              <SelectTrigger aria-label="Template category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TEMPLATE_CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-file">File</Label>
            <Input
              id="template-file"
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
            <p className="text-xs text-muted-foreground">
              PDF, Word, Excel, JPG or PNG - up to 10 MB.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceDialog({
  template,
  open,
  onOpenChange,
}: {
  template: TemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, formAction, pending } = useToastedAction(replaceTemplateAction);
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
          <DialogTitle>New version of {template.name}</DialogTitle>
          <DialogDescription>
            The current v{template.version} stays downloadable - History keeps
            every previous file.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => {
            startTransition(() => formAction(data));
          }}
          className="space-y-4"
        >
          <input type="hidden" name="template_id" value={template.id} />
          <div className="space-y-2">
            <Label htmlFor={`replace-file-${template.id}`}>Replacement file</Label>
            <Input
              id={`replace-file-${template.id}`}
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <History />}
              Upload v{template.version + 1}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VersionList({ versions }: { versions: TemplateRow[] }) {
  const [open, setOpen] = useState(false);
  if (versions.length <= 1) return null;
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen((value) => !value)}
      >
        <History /> History ({versions.length - 1})
      </Button>
      {open ? (
        <ul className="space-y-1 pl-2">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <a href={`/api/templates/${version.id}`} className="hover:underline">
                v{version.version} · {version.file_name}
              </a>
              {!version.is_active ? <span>(superseded)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TemplateGroup({
  name,
  rows,
}: {
  name: string;
  rows: TemplateRow[];
}) {
  const active = rows.find((row) => row.is_active) ?? rows[0];
  const [replaceOpen, setReplaceOpen] = useState(false);
  const { formAction, pending } = useToastedAction(deleteTemplateAction);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!active) return null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {active.description ? (
          <p className="text-xs text-muted-foreground">{active.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {active.file_name} · {formatBytes(active.size_bytes)} · updated{' '}
          {formatDate(active.created_at)}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">v{active.version}</Badge>
          {rows.length > 1 ? <VersionList versions={rows} /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/templates/${active.id}`}>
            <Download /> Download
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setReplaceOpen(true)}>
          <History /> New version
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Delete template"
          disabled={pending}
          onClick={() => {
            if (confirmDelete) {
              const data = new FormData();
              data.set('template_id', active.id);
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
        <ReplaceDialog
          template={active}
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
        />
      </div>
    </div>
  );
}

/** Groups rows by name - each name is one logical template with version rows. */
export function TemplateManager({ templates }: { templates: TemplateRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  const groups = new Map<string, TemplateRow[]>();
  for (const row of templates) {
    const existing = groups.get(row.name) ?? [];
    existing.push(row);
    groups.set(row.name, existing);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => b.version - a.version);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {groups.size} template{groups.size === 1 ? '' : 's'} - older versions
          stay downloadable
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Upload template
        </Button>
      </div>

      {groups.size === 0 ? (
        <p className="text-sm text-muted-foreground">
          No templates yet - upload the blank proposal, liquidation and
          accomplishment forms first.
        </p>
      ) : (
        <div className="space-y-3">
          {[...groups.entries()].map(([name, rows]) => (
            <TemplateGroup key={name} name={name} rows={rows} />
          ))}
        </div>
      )}

      <UploadDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
