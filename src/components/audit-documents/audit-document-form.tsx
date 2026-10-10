'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  createAuditDocumentAction,
  updateAuditDocumentAction,
} from '@/lib/actions/audit-documents';
import { type ActionResult } from '@/lib/action-result';
import {
  AUDIT_DOC_TYPES,
  AUDIT_DOC_TYPE_LABELS,
  SEMESTERS,
  SEMESTER_LABELS,
  auditDocumentSchema,
  type AuditDocumentInput,
} from '@/lib/validations/audit-documents';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const INITIAL: ActionResult = { ok: true };

const SELECT_CLASS =
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function AuditDocumentForm({
  mode,
  document,
}: {
  mode: 'create' | 'edit';
  document?: (AuditDocumentInput & { id: string }) | null;
}) {
  const action =
    mode === 'create' ? createAuditDocumentAction : updateAuditDocumentAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  const form = useForm<AuditDocumentInput>({
    resolver: zodResolver(auditDocumentSchema),
    defaultValues: {
      id: document?.id,
      title: document?.title ?? '',
      description: document?.description ?? '',
      doc_type: document?.doc_type ?? 'financial_statement',
      semester: document?.semester ?? 'first',
    },
  });

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  function onSubmit(values: AuditDocumentInput) {
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('title', values.title);
    formData.set('description', values.description ?? '');
    formData.set('doc_type', values.doc_type);
    formData.set('semester', values.semester);
    startTransition(() => formAction(formData));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document title</FormLabel>
              <FormControl>
                <Input
                  placeholder="SY 2026-2027 1st Semester Financial Statement"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="doc_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document type</FormLabel>
                <FormControl>
                  <select
                    className={SELECT_CLASS}
                    value={field.value}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value as AuditDocumentInput['doc_type']
                      )
                    }
                  >
                    {AUDIT_DOC_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {AUDIT_DOC_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="semester"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Semester</FormLabel>
                <FormControl>
                  <select
                    className={SELECT_CLASS}
                    value={field.value}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value as AuditDocumentInput['semester']
                      )
                    }
                  >
                    {SEMESTERS.map((semester) => (
                      <option key={semester} value={semester}>
                        {SEMESTER_LABELS[semester]}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Scope, coverage and other notes…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {mode === 'create' ? 'Create draft' : 'Save changes'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {mode === 'create'
              ? 'The document starts as a draft - nothing is sent until you submit it.'
              : 'Only the draft fields can be edited.'}
          </p>
        </div>
      </form>
    </Form>
  );
}
