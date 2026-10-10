'use client';

import { useActionState, useEffect, useRef, startTransition, useState } from 'react';
import { useWatch, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, KeyRound, Pencil, Power } from 'lucide-react';
import { toast } from 'sonner';

import {
  resetUserPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
} from '@/lib/actions/users';
import { type ActionResult } from '@/lib/action-result';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/labels';
import type { UserRole } from '@/lib/navigation';
import {
  resetPasswordSchema,
  updateUserSchema,
  USER_ROLES,
  type ResetPasswordInput,
  type UpdateUserInput,
} from '@/lib/validations/users';
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

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  position: string | null;
  is_active: boolean;
  college_id?: string | null;
}

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

function useActionToast(
  state: ActionResult,
  onSuccess?: () => void
): void {
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) {
      toast.success(state.message ?? 'Saved.');
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
}

export function UserActions({
  user,
  organizations,
  colleges,
  isSelf,
}: {
  user: UserRow;
  organizations: OrgOption[];
  colleges: CollegeOption[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [editState, editFormAction, editPending] = useActionState(
    updateUserAction,
    INITIAL
  );
  const [toggleState, toggleFormAction, togglePending] = useActionState(
    toggleUserActiveAction,
    INITIAL
  );
  const [resetState, resetFormAction, resetPending] = useActionState(
    resetUserPasswordAction,
    INITIAL
  );

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { id: user.id, password: '' },
  });

  useActionToast(editState, () => setOpen(false));
  useActionToast(toggleState);
  useActionToast(resetState, () => {
    setResetOpen(false);
    resetForm.reset();
  });

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      organization_id: '',
      college_id: user.college_id ?? '',
      position: user.position ?? '',
      is_active: user.is_active,
    },
  });

  const role = useWatch({ control: form.control, name: 'role' });
  const needsOrganization = role === 'adviser' || role === 'officer';
  const needsCollege = role === 'dean';

  function onSubmit(values: UpdateUserInput) {
    const formData = new FormData();
    formData.set('id', values.id);
    formData.set('full_name', values.full_name);
    formData.set('role', values.role);
    formData.set('organization_id', values.organization_id ?? '');
    formData.set('college_id', values.college_id ?? '');
    formData.set('position', values.position ?? '');
    formData.set('is_active', values.is_active ? 'on' : '');
    startTransition(() => editFormAction(formData));
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {user.full_name}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
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
                      <Input {...field} />
                    </FormControl>
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
                      <Input placeholder="President, Secretary…" {...field} />
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
                      <FormLabel>Account active</FormLabel>
                      <FormDescription>
                        Inactive accounts cannot sign in.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSelf}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={editPending}>
                  {editPending ? <Loader2 className="animate-spin" /> : null}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" title="Reset password">
            <KeyRound /> Reset
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {user.full_name} — {user.email}. They can sign in with the new
              password immediately.
            </DialogDescription>
          </DialogHeader>

          <Form {...resetForm}>
            <form
              onSubmit={resetForm.handleSubmit((values) => {
                const formData = new FormData();
                formData.set('id', values.id);
                formData.set('password', values.password);
                startTransition(() => resetFormAction(formData));
              })}
              className="space-y-4"
            >
              <FormField
                control={resetForm.control}
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

              <DialogFooter>
                <Button type="submit" disabled={resetPending}>
                  {resetPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                  Reset password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <form action={toggleFormAction}>
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="is_active" value={user.is_active ? '' : 'on'} />
        <Button
          type="submit"
          variant={user.is_active ? 'ghost' : 'outline'}
          size="sm"
          disabled={isSelf || togglePending}
          title={isSelf ? 'You cannot deactivate your own account' : undefined}
        >
          {togglePending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Power />
          )}
          {user.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </form>
    </div>
  );
}
