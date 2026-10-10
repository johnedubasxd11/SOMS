import { PageHeader } from '@/components/layout/page-header';
import { CalendarBoard } from '@/components/calendar/calendar-board';
import { requireProfile } from '@/lib/auth';
import { monthKey, type CalendarEvent } from '@/lib/calendar';
import { createClient } from '@/lib/supabase/server';

/**
 * Shared calendar of approved activities plus the caller's own in-flight
 * events. Which rows come back is decided by `v_calendar_events` (Phase 4
 * migration) - the page only adds filters on top, so officers see their own
 * organization's pipeline and every approved activity, advisers and deans
 * their organizations, and OSA everything.
 */
export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: events }, { data: colleges }, { data: organizations }] =
    await Promise.all([
      supabase
        .from('v_calendar_events')
        .select('*')
        .order('activity_date', { ascending: true }),
      supabase.from('colleges').select('id, name').order('name'),
      supabase.from('organizations').select('id, name, college_id').order('name'),
    ]);

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity calendar"
        description={
          isOsa
            ? 'Every organization&apos;s activities, with the venue bookings that are already in the pipeline.'
            : 'Approved activities across campus plus your organization&apos;s submissions in progress.'
        }
      />

      <CalendarBoard
        events={(events ?? []) as CalendarEvent[]}
        colleges={(colleges ?? []) as { id: string; name: string }[]}
        organizations={
          (organizations ?? []) as {
            id: string;
            name: string;
            college_id: string | null;
          }[]
        }
        initialMonth={monthKey(new Date())}
      />
    </div>
  );
}
