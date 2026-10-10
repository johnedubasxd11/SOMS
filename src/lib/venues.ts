import 'server-only';

import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Row of the canonical venue list as the forms and calendar consume it. */
export interface VenueOption {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
}

/** Active venues for the proposal form (plus the record's own, if deactivated). */
export async function listVenueOptions(
  supabase: Supabase,
  { keepId }: { keepId?: string | null } = {}
): Promise<VenueOption[]> {
  const { data } = await supabase
    .from('venues')
    .select('id, name, location, capacity, is_active')
    .or(keepId ? `is_active.eq.true,id.eq.${keepId}` : 'is_active.eq.true')
    .order('name');

  return (data ?? []) as VenueOption[];
}
