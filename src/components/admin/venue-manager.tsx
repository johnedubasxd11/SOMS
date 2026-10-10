'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  createVenueAction,
  deleteVenueAction,
  toggleVenueActiveAction,
  updateVenueAction,
} from '@/lib/actions/venues';
import { type ActionResult } from '@/lib/action-result';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const INITIAL: ActionResult = { ok: true };

export interface VenueRow {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
}

function useToastedAction(
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>
) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  return { state, formAction, pending };
}

function VenueDialog({
  mode,
  venue,
  open,
  onOpenChange,
}: {
  mode: 'create' | 'edit';
  venue?: VenueRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = mode === 'create' ? createVenueAction : updateVenueAction;
  const { state, formAction, pending } = useToastedAction(action);
  const lastResult = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === INITIAL || state === lastResult.current) return;
    lastResult.current = state;
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add venue' : 'Edit venue'}</DialogTitle>
          <DialogDescription>
            Venues on this list appear in the proposal form and are checked for
            double bookings.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => {
            startTransition(() => formAction(data));
          }}
          className="space-y-4"
        >
          {venue ? <input type="hidden" name="id" value={venue.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor={`venue-name-${mode}`}>Name</Label>
            <Input
              id={`venue-name-${mode}`}
              name="name"
              required
              defaultValue={venue?.name ?? ''}
              placeholder="Covered Court"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`venue-location-${mode}`}>Location</Label>
            <Input
              id={`venue-location-${mode}`}
              name="location"
              defaultValue={venue?.location ?? ''}
              placeholder="Main quadrangle, in front of the chapel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`venue-capacity-${mode}`}>Capacity (optional)</Label>
            <Input
              id={`venue-capacity-${mode}`}
              name="capacity"
              type="number"
              min={1}
              defaultValue={venue?.capacity ?? ''}
              placeholder="300"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              {mode === 'create' ? 'Add venue' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({ venue }: { venue: VenueRow }) {
  const { formAction, pending } = useToastedAction(toggleVenueActiveAction);
  const { formAction: deleteAction, pending: deletePending } =
    useToastedAction(deleteVenueAction);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Edit venue"
        onClick={() => setEditOpen(true)}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={venue.is_active ? 'Deactivate venue' : 'Reactivate venue'}
        disabled={pending}
        onClick={() => {
          const data = new FormData();
          data.set('id', venue.id);
          startTransition(() => formAction(data));
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Power />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Delete venue"
        disabled={deletePending}
        onClick={() => {
          if (confirmDelete) {
            const data = new FormData();
            data.set('id', venue.id);
            startTransition(() => deleteAction(data));
            setConfirmDelete(false);
          } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
          }
        }}
      >
        {deletePending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
      {confirmDelete ? (
        <p className="text-xs text-destructive">Click again to delete</p>
      ) : null}

      <VenueDialog
        mode="edit"
        venue={venue}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

export function VenueManager({ venues }: { venues: VenueRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {venues.length} venue{venues.length === 1 ? '' : 's'} on the list
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Add venue
        </Button>
      </div>

      {venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No venues yet - add the on-campus venues officers book most often.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Capacity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {venues.map((venue) => (
                <tr key={venue.id} className={venue.is_active ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 font-medium">{venue.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {venue.location ?? '—'}
                  </td>
                  <td className="px-3 py-2">{venue.capacity ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={venue.is_active ? 'secondary' : 'outline'}>
                      {venue.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <RowActions venue={venue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VenueDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
