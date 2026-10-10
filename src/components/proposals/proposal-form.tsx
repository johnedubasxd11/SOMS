'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  createProposalAction,
  updateProposalAction,
} from '@/lib/actions/proposals';
import { type ActionResult } from '@/lib/action-result';
import type { VenueOption } from '@/lib/venues';
import {
  proposalSchema,
  type ProposalInput,
} from '@/lib/validations/proposals';
import { VenueConflictWarning } from '@/components/proposals/venue-conflict-warning';
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
import { Textarea } from '@/components/ui/textarea';

const INITIAL: ActionResult = { ok: true };

const SELECT_CLASS =
  'flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function ProposalForm({
  mode,
  proposal,
  venues,
}: {
  mode: 'create' | 'edit';
  proposal?: (ProposalInput & { id: string }) | null;
  venues: VenueOption[];
}) {
  const action = mode === 'create' ? createProposalAction : updateProposalAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  const form = useForm<ProposalInput>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      id: proposal?.id,
      title: proposal?.title ?? '',
      description: proposal?.description ?? '',
      objectives: proposal?.objectives ?? '',
      activity_date: proposal?.activity_date ?? '',
      start_time: proposal?.start_time ?? '',
      end_time: proposal?.end_time ?? '',
      venue: proposal?.venue ?? '',
      venue_id: proposal?.venue_id,
      participants_count: proposal?.participants_count ?? 0,
      budget: proposal?.budget ?? 0,
      source_of_funds: proposal?.source_of_funds ?? '',
    },
  });

  // Toasts talk to an external system, so they belong in an effect; the state
  // itself is never touched here (React Compiler lint).
  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  const selectedVenueId = useWatch({ control: form.control, name: 'venue_id' });
  const activityDate = useWatch({ control: form.control, name: 'activity_date' });
  const startTime = useWatch({ control: form.control, name: 'start_time' });
  const endTime = useWatch({ control: form.control, name: 'end_time' });
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId);

  function onSubmit(values: ProposalInput) {
    const formData = new FormData();
    if (values.id) formData.set('id', values.id);
    formData.set('title', values.title);
    formData.set('description', values.description ?? '');
    formData.set('objectives', values.objectives ?? '');
    formData.set('activity_date', values.activity_date);
    formData.set('start_time', values.start_time ?? '');
    formData.set('end_time', values.end_time ?? '');
    formData.set('venue', values.venue);
    formData.set('venue_id', values.venue_id ?? '');
    formData.set('participants_count', String(values.participants_count));
    formData.set('budget', String(values.budget));
    formData.set('source_of_funds', values.source_of_funds ?? '');
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
              <FormLabel>Activity title</FormLabel>
              <FormControl>
                <Input placeholder="Inter-College Debate Championship" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="activity_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Activity date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="venue_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue</FormLabel>
                <FormControl>
                  <select
                    className={SELECT_CLASS}
                    value={field.value ?? ''}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const id = event.target.value;
                      field.onChange(id || undefined);
                      const venue = venues.find((item) => item.id === id);
                      // The stored venue text mirrors the canonical name, so
                      // lists and printed cover sheets never show an alias.
                      if (venue) form.setValue('venue', venue.name);
                    }}
                  >
                    <option value="">Other venue (type it in below)</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                        {venue.capacity ? ` - up to ${venue.capacity}` : ''}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>
                  {selectedVenue?.location ??
                    'On-campus venues are conflict-checked against other bookings.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!selectedVenue ? (
          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue (free text)</FormLabel>
                <FormControl>
                  <Input placeholder="Off-campus address or unlisted room" {...field} />
                </FormControl>
                <FormDescription>
                  Free-text venues (off campus) are not conflict-checked.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <VenueConflictWarning
          venueId={selectedVenueId ?? null}
          activityDate={activityDate}
          startTime={startTime}
          endTime={endTime}
          recordId={proposal?.id}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="participants_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected participants</FormLabel>
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
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget (PHP)</FormLabel>
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
          name="source_of_funds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source of funds</FormLabel>
              <FormControl>
                <Input
                  placeholder="Organization dues, activity fees, sponsorships…"
                  {...field}
                />
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
                  placeholder="What the activity is about…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="objectives"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Objectives</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What the activity aims to achieve…"
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
              ? 'The proposal starts as a draft - nothing is sent until you submit it.'
              : 'Only the draft fields can be edited.'}
          </p>
        </div>
      </form>
    </Form>
  );
}
