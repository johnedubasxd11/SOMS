'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FileImage,
  FileText,
  History,
  Loader2,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteAttachmentAction,
  uploadAttachmentAction,
} from '@/lib/actions/submissions';
import { type ActionResult } from '@/lib/action-result';
import { formatBytes, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const INITIAL: ActionResult = { ok: true };

export interface AttachmentVersion {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploader_name: string | null;
  version: number;
  created_at: string;
}

export interface AttachmentFile extends AttachmentVersion {
  /** Older versions of this file, newest first - all still downloadable. */
  history: AttachmentVersion[];
}

export function Attachments({
  recordId,
  moduleKey,
  files,
  canUpload,
  isOsa,
  currentUserId,
  editable,
}: {
  recordId: string;
  moduleKey: string;
  files: AttachmentFile[];
  canUpload: boolean;
  isOsa: boolean;
  currentUserId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadAttachmentAction, INITIAL);
  const [selected, setSelected] = useState<File[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [handled, setHandled] = useState<ActionResult | null>(null);
  const notified = useRef<string | null>(null);

  // Reset the picker when an upload succeeds (render-phase state adjustment).
  if (state !== INITIAL && state !== handled && state.ok) {
    setHandled(state);
    setSelected([]);
    setResetKey((key) => key + 1);
  }

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Uploaded.');
    else toast.error(state.error);
  }, [state]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0) {
      toast.error('Choose a file to attach first.');
      return;
    }
    const formData = new FormData();
    formData.set('id', recordId);
    formData.set('module', moduleKey);
    selected.forEach((file) => formData.append('file', file));
    startTransition(() => formAction(formData));
  }

  return (
    <div className="space-y-4">
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((file) => (
            <AttachmentRow
              key={file.id}
              file={file}
              recordId={recordId}
              moduleKey={moduleKey}
              canUpload={canUpload}
              isOsa={isOsa}
              currentUserId={currentUserId}
              editable={editable}
            />
          ))}
        </ul>
      )}

      {canUpload ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              key={resetKey}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(event) =>
                setSelected(Array.from(event.target.files ?? []))
              }
              className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload />}
              Attach
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, DOC, DOCX, XLS, XLSX, JPG or PNG - up to 10 MB each, 5 files
            per upload. Uploading a file with an existing name saves it as a
            new version; the old one stays downloadable.
          </p>
        </form>
      ) : null}
    </div>
  );
}

function AttachmentRow({
  file,
  recordId,
  moduleKey,
  canUpload,
  isOsa,
  currentUserId,
  editable,
}: {
  file: AttachmentFile;
  recordId: string;
  moduleKey: string;
  canUpload: boolean;
  isOsa: boolean;
  currentUserId: string;
  editable: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        {file.mime_type.startsWith('image/') ? (
          <FileImage className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <a
            href={`/api/files/${file.id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {file.file_name}
          </a>
          <p className="truncate text-xs text-muted-foreground">
            {formatBytes(file.size_bytes)}
            {file.uploader_name ? ` · ${file.uploader_name}` : ''}
            {` · ${formatDate(file.created_at)}`}
          </p>
        </div>
        {file.version > 1 || file.history.length > 0 ? (
          <Badge variant="secondary" className="shrink-0">
            v{file.version}
          </Badge>
        ) : null}
        {file.history.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((open) => !open)}
          >
            <History />
            {showHistory ? 'Hide' : 'History'} ({file.history.length})
          </Button>
        ) : null}
        {canUpload ? <NewVersionButton file={file} recordId={recordId} moduleKey={moduleKey} /> : null}
        {isOsa || (file.uploaded_by === currentUserId && editable) ? (
          <DeleteButton documentId={file.id} />
        ) : null}
      </div>

      {showHistory && file.history.length > 0 ? (
        <ul className="mt-2 space-y-1 border-l pl-4">
          {file.history.map((version) => (
            <li
              key={version.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <a
                href={`/api/files/${version.id}`}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                v{version.version} · {version.file_name}
              </a>
              <span className="shrink-0">{formatBytes(version.size_bytes)}</span>
              <span className="shrink-0">{formatDate(version.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NewVersionButton({
  file,
  recordId,
  moduleKey,
}: {
  file: AttachmentFile;
  recordId: string;
  moduleKey: string;
}) {
  const [state, formAction, pending] = useActionState(uploadAttachmentAction, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'New version uploaded.');
    else toast.error(state.error);
  }, [state]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (!chosen) return;
          const formData = new FormData();
          formData.set('id', recordId);
          formData.set('module', moduleKey);
          formData.set('replace_document_id', file.id);
          formData.set('file', chosen);
          startTransition(() => formAction(formData));
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Upload a new version of this file"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? <Loader2 className="animate-spin" /> : <UploadCloud />}
      </Button>
    </>
  );
}

function DeleteButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(deleteAttachmentAction, INITIAL);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'File removed.');
    else toast.error(state.error);
  }, [state]);

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label="Remove attachment"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set('document_id', documentId);
        startTransition(() => action(formData));
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
