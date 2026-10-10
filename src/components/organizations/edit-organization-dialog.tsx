'use client';

import { useActionState, useEffect, useRef, startTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { updateOrganizationAction } from '@/lib/actions/organizations';
import { type ActionResult } from '@/lib/action-result';
import {
  ACCREDITATION_LABELS,
  ACCREDITATION_STATUSES,
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@/lib/validations/organizations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export interface EditableOrganization {
  id: string;
  name: string;
  code: string;
  description: string | null;
  accreditation_status: string;
  accreditation_valid_until: string | null;
  membership_count: number;
  is_active: boolean;
}

const INITIAL: ActionResult = { ok: true };

export function EditOrganizationDialog({
  organization,
}: {
  organization: EditableOrganization;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationAction,
    INITIAL
  );
  const [open, setOpen] = useState(false);
  const [handledState, setHandledState] = useState<ActionResult | null>(null);
  const notified = useRef<string | null>(null);

  const form = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      id: organization.id,
      description: organization.description ?? '',
      accreditation_status:
        organization.accreditation_status as UpdateOrganizationInput['accreditation_status'],
      accreditation_valid_until: organization.accreditation_valid_until ?? '',
      membership_count: organization.membership_count,
      is_active: organization.is_active,
    },
  });

  // Close as soon as the save succeeds (render-phase adjustment, not an
  // effect); toasts talk to an external system and belong in an effect.
  if (state !== INITIAL && state !== handledState && state.ok) {
    setHandledState(state);
    setOpen(false);
  }

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  function onSubmit(values: UpdateOrganizationInput) {
    const formData = new FormData();
    formData.set('id', values.id);
    formData.set('description', values.description ?? '');
    formData.set('accreditation_status', values.accreditation_status);
    formData.set('accreditation_valid_until', values.accreditation_valid_until ?? '');
    formData.set('membership_count', String(values.membership_count));
    formData.set('is_active', values.is_active ? 'on' : '');
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 /> Edit record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {organization.name}</DialogTitle>
          <DialogDescription>
            Accreditation, membership and availability for {organization.code}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accreditation_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accreditation status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCREDITATION_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {ACCREDITATION_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="accreditation_valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid until</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="membership_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={field.value}
                        name={field.name}
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          field.onChange(event.target.valueAsNumber)
                        }
                      />
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
                      rows={3}
                      placeholder="What the organization does…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active organization</FormLabel>
                    <FormDescription>
                      Inactive organizations are excluded from semester reports.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
