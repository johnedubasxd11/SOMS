'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  createReportAction,
  updateReportAction,
} from '@/lib/actions/reports';
import { type ActionResult } from '@/lib/action-result';
import { reportSchema, type ReportInput } from '@/lib/validations/reports';
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

export interface ApprovedActivityOption {
  id: string;
  label: string;
}

export function ReportForm({
  mode,
  report,
  activities,
}: {
  mode: 'create' | 'edit';
  report?: (ReportInput & { id: string }) | null;
  /** Approved proposals of this organization, offered as the linked activity. */
  activities: ApprovedActivityOption[];
}) {
  const action = mode === 'create' ? createReportAction : updateReportAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  const form = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      id: report?.id,
      title: report?.title ?? '',
      summary: report?.summary ?? '',
      outcomes: report?.outcomes ?? '',
      attendance_count: report?.attendance_count ?? 0,
      budget_spent: report?.budget_spent ?? 0,
      liquidation_summary: report?.liquidation_summary ?? '',
      proposal_id: report?.proposal_id ?? '',
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

  function onSubmit(values: ReportInput) {
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('title', values.title);
    formData.set('summary', values.summary ?? '');
    formData.set('outcomes', values.outcomes ?? '');
    formData.set('attendance_count', String(values.attendance_count));
    formData.set('budget_spent', String(values.budget_spent));
    formData.set('liquidation_summary', values.liquidation_summary ?? '');
    formData.set('proposal_id', values.proposal_id ?? '');
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
              <FormLabel>Report title</FormLabel>
              <FormControl>
                <Input placeholder="Inter-College Debate Championship - Report" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="proposal_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Linked activity (optional)</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={field.value ?? ''}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value)}
                >
                  <option value="">No linked activity</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.label}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="attendance_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Actual attendance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={field.value}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="budget_spent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget spent (PHP)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={field.value}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What happened during the activity…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="outcomes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outcomes</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Results, lessons learned and impact…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="liquidation_summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Liquidation summary</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="How the funds were spent…"
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
              ? 'The report starts as a draft - nothing is sent until you submit it.'
              : 'Only the draft fields can be edited.'}
          </p>
        </div>
      </form>
    </Form>
  );
}
