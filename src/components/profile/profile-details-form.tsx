'use client';

import { useActionState, useEffect, useRef, startTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { updateProfileAction } from '@/lib/actions/profiles';
import { type ActionResult } from '@/lib/action-result';
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from '@/lib/validations/profiles';
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

export function ProfileDetailsForm({
  profile,
}: {
  profile: { full_name: string; position: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    INITIAL
  );
  const notified = useRef<string | null>(null);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: profile.full_name,
      position: profile.position ?? '',
    },
  });

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) {
      toast.success(state.message ?? 'Profile updated.');
    } else {
      toast.error(state.error);
    }
  }, [state]);

  function onSubmit(values: UpdateProfileInput) {
    const formData = new FormData();
    formData.set('full_name', values.full_name);
    formData.set('position', values.position ?? '');
    startTransition(() => formAction(formData));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position</FormLabel>
              <FormControl>
                <Input placeholder="President, Secretary…" {...field} />
              </FormControl>
              <FormDescription>
                Shown next to your name in review timelines.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Save details
        </Button>
      </form>
    </Form>
  );
}
