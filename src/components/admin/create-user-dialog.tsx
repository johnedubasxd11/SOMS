'use client';

import { useActionState, useEffect, useRef, startTransition, useState } from 'react';
import { useWatch, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { createUserAction } from '@/lib/actions/users';
import { type ActionResult } from '@/lib/action-result';
import {
  createUserSchema,
  USER_ROLES,
  type CreateUserInput,
} from '@/lib/validations/users';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/labels';
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

export interface OrgOption {
  id: string;
  code: string;
  name: string;
}

export interface CollegeOption {
  id: string;
  code: string;
  name: string;
}

const INITIAL: ActionResult = { ok: true };

export function CreateUserDialog({
  organizations,
  colleges,
}: {
  organizations: OrgOption[];
  colleges: CollegeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, INITIAL);
  const [handledState, setHandledState] = useState<ActionResult | null>(null);
  const notified = useRef<string | null>(null);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'officer',
      organization_id: '',
      college_id: '',
      position: '',
    },
  });

  const role = useWatch({ control: form.control, name: 'role' });
  const needsOrganization = role === 'adviser' || role === 'officer';
  const needsCollege = role === 'dean';

  // Close the dialog the moment a successful result arrives (React's
  // render-phase state adjustment - deliberately not an effect).
  if (state !== INITIAL && state !== handledState && state.ok) {
    setHandledState(state);
    setOpen(false);
  }

  // Toasts talk to an external system, which is what effects are for.
  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Account created.');
    else toast.error(state.error);
  }, [state]);

  function handleOpenChange(next: boolean) {
    if (next) form.reset();
    setOpen(next);
  }

  function onSubmit(values: CreateUserInput) {
    const formData = new FormData();
    formData.set('full_name', values.full_name);
    formData.set('email', values.email);
    formData.set('password', values.password);
    formData.set('role', values.role);
    formData.set('organization_id', values.organization_id ?? '');
    formData.set('college_id', values.college_id ?? '');
    formData.set('position', values.position ?? '');
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> New account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an account</DialogTitle>
          <DialogDescription>
            The new user can sign in immediately with the password you set.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="name@acd.edu.ph" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>
                    At least 8 characters. The user can change it later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USER_ROLES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {ROLE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{ROLE_DESCRIPTIONS[role]}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsOrganization ? (
              <FormField
                control={form.control}
                name="organization_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.code} — {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {needsCollege ? (
              <FormField
                control={form.control}
                name="college_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>College</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a college" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colleges.map((college) => (
                          <SelectItem key={college.id} value={college.id}>
                            {college.code} — {college.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        role === 'officer'
                          ? 'President, Secretary, Treasurer…'
                          : role === 'adviser'
                            ? 'Faculty Adviser'
                            : 'Optional'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Create account
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
