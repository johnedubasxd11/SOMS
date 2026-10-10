'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  createOtherDocumentAction,
  updateOtherDocumentAction,
} from '@/lib/actions/other-documents';
import { type ActionResult } from '@/lib/action-result';
import {
  OTHER_DOCUMENT_CATEGORIES,
  OTHER_DOCUMENT_CATEGORY_LABELS,
  otherDocumentSchema,
  type OtherDocumentInput,
} from '@/lib/validations/other-documents';
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

export function OtherDocumentForm({
  mode,
  document,
}: {
  mode: 'create' | 'edit';
  document?: (OtherDocumentInput & { id: string }) | null;
}) {
  const action =
    mode === 'create' ? createOtherDocumentAction : updateOtherDocumentAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  const form = useForm<OtherDocumentInput>({
    resolver: zodResolver(otherDocumentSchema),
    defaultValues: {
      id: document?.id,
      title: document?.title ?? '',
      description: document?.description ?? '',
      category: document?.category ?? 'other',
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

  function onSubmit(values: OtherDocumentInput) {
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('title', values.title);
    formData.set('description', values.description ?? '');
    formData.set('category', values.category);
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
                <Input placeholder="Resolution No. 001 - Sy 2026-2027" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={field.value}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value as OtherDocumentInput['category']
                    )
                  }
                >
                  {OTHER_DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {OTHER_DOCUMENT_CATEGORY_LABELS[category]}
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What this document is about…"
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
