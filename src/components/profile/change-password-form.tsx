'use client';

import { useActionState, useEffect, useRef, startTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { changePasswordAction } from '@/lib/actions/profiles';
import { type ActionResult } from '@/lib/action-result';
import {
  changePasswordSchema,
  type ChangePasswordInput,
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

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    INITIAL
  );
  const notified = useRef<string | null>(null);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) {
      toast.success(state.message ?? 'Password updated.');
      form.reset();
    } else {
      toast.error(state.error);
    }
  }, [state, form]);

  function onSubmit(values: ChangePasswordInput) {
    const formData = new FormData();
    formData.set('password', values.password);
    formData.set('confirm', values.confirm);
    startTransition(() => formAction(formData));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormDescription>Use at least 8 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Change password
        </Button>
      </form>
    </Form>
  );
}
