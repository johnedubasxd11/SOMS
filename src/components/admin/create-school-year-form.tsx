'use client';

import { useActionState, useEffect, useRef, startTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createSchoolYearAction } from '@/lib/actions/school-years';
import { type ActionResult } from '@/lib/action-result';
import {
  createSchoolYearSchema,
  type CreateSchoolYearInput,
} from '@/lib/validations/organizations';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const INITIAL: ActionResult = { ok: true };

export function CreateSchoolYearForm() {
  const [state, formAction, pending] = useActionState(
    createSchoolYearAction,
    INITIAL
  );
  const notified = useRef<string | null>(null);

  const form = useForm<CreateSchoolYearInput>({
    resolver: zodResolver(createSchoolYearSchema),
    defaultValues: {
      name: '',
      start_date: '',
      end_date: '',
      is_current: false,
    },
  });

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) {
      toast.success(state.message ?? 'School year created.');
      form.reset();
    } else {
      toast.error(state.error);
    }
  }, [state, form]);

  function onSubmit(values: CreateSchoolYearInput) {
    const formData = new FormData();
    formData.set('name', values.name);
    formData.set('start_date', values.start_date);
    formData.set('end_date', values.end_date);
    formData.set('is_current', values.is_current ? 'on' : '');
    startTransition(() => formAction(formData));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School year</FormLabel>
              <FormControl>
                <Input placeholder="2027-2028" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_current"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="size-4 accent-primary"
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="font-normal">
                  Make this the current school year
                </FormLabel>
                <FormDescription>
                  Only one school year can be current at a time.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
          Create school year
        </Button>
      </form>
    </Form>
  );
}
