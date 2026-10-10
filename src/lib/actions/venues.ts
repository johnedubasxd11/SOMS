'use server';

import { revalidatePath } from 'next/cache';

import { fail, firstError, ok, type ActionResult } from '@/lib/action-result';
import { requireOsa, requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  conflictQuerySchema,
  venueSchema,
} from '@/lib/validations/venues';
import { asString, isUuid, readable, toNumber } from './shared';

/**
 * Venue management (OSA only) plus the conflict lookup the proposal form
 * calls while the officer is still typing. Every conflict answer comes from
 * `find_venue_conflicts()` - the same function the submit guard trigger uses,
 * so the warning the officer sees and the rule the database enforces can
 * never drift apart.
 */

export interface VenueConflict {
  recordId: string;
  referenceNumber: string;
  title: string;
  organizationName: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Live conflict check for one candidate slot. Any signed-in user may ask:
 * the answer is scoped by the RPC to live bookings, which are exactly the
 * events the calendar already shows to everybody.
 */
export async function findVenueConflicts(input: {
  venueId: string;
  activityDate: string;
  startTime?: string | null;
  endTime?: string | null;
  excludeId?: string | null;
}): Promise<VenueConflict[]> {
  await requireProfile();

  const parsed = conflictQuerySchema.safeParse({
    venue_id: input.venueId,
    activity_date: input.activityDate,
    start_time: input.startTime || undefined,
    end_time: input.endTime || undefined,
    exclude_id: input.excludeId || undefined,
  });
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('find_venue_conflicts', {
    p_venue_id: parsed.data.venue_id,
    p_date: parsed.data.activity_date,
    p_start: parsed.data.start_time || undefined,
    p_end: parsed.data.end_time || undefined,
    p_exclude_id: parsed.data.exclude_id || undefined,
  });

  if (error) return [];

  return (data ?? []).map((row) => ({
    recordId: row.record_id,
    referenceNumber: row.reference_number,
    title: row.title,
    organizationName: row.organization_name,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

function readVenueFields(formData: FormData) {
  const capacity = toNumber(formData.get('capacity'));
  return {
    id: asString(formData.get('id')) || undefined,
    name: asString(formData.get('name')),
    location: asString(formData.get('location')) || undefined,
    capacity: Number.isFinite(capacity) ? capacity : undefined,
  };
}

/** OSA: adds a venue to the canonical list. */
export async function createVenueAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = venueSchema.safeParse(readVenueFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));
  delete parsed.data.id;

  const supabase = await createClient();
  const { error } = await supabase.from('venues').insert({
    name: parsed.data.name,
    location: parsed.data.location || null,
    capacity: parsed.data.capacity ?? null,
  });

  if (error) {
    return error.code === '23505'
      ? fail('A venue with that name already exists.')
      : fail(readable(error));
  }

  revalidatePath('/osa/venues');
  revalidatePath('/calendar');
  return ok(`Venue "${parsed.data.name}" added.`);
}

/** OSA: renames / relocates a venue. */
export async function updateVenueAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const parsed = venueSchema.safeParse(readVenueFields(formData));
  if (!parsed.success) return fail(firstError(parsed.error.issues));
  if (!parsed.data.id) return fail('Invalid venue id.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('venues')
    .update({
      name: parsed.data.name,
      location: parsed.data.location || null,
      capacity: parsed.data.capacity ?? null,
    })
    .eq('id', parsed.data.id);

  if (error) {
    return error.code === '23505'
      ? fail('A venue with that name already exists.')
      : fail(readable(error));
  }

  revalidatePath('/osa/venues');
  revalidatePath('/calendar');
  return ok('Venue updated.');
}

/** OSA: hides a venue from the proposal form without losing its history. */
export async function toggleVenueActiveAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const id = asString(formData.get('id'));
  if (!isUuid(id)) return fail('Invalid venue id.');

  const supabase = await createClient();
  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!venue) return fail('Venue not found.');

  const { error } = await supabase
    .from('venues')
    .update({ is_active: !venue.is_active })
    .eq('id', venue.id);

  if (error) return fail(readable(error));

  revalidatePath('/osa/venues');
  return ok(venue.is_active ? 'Venue deactivated.' : 'Venue reactivated.');
}

/** OSA: removes a venue that is no longer used (bookings keep their text). */
export async function deleteVenueAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireOsa();

  const id = asString(formData.get('id'));
  if (!isUuid(id)) return fail('Invalid venue id.');

  const supabase = await createClient();
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) return fail(readable(error));

  revalidatePath('/osa/venues');
  revalidatePath('/calendar');
  return ok('Venue deleted.');
}
