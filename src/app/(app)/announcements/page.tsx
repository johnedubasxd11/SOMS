import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  AnnouncementBoard,
  type AnnouncementRow,
} from '@/components/admin/announcement-board';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Public announcement board (Phase 7). RLS on `announcements` computes who
 * sees what: OSA sees everything (including expired); everyone else sees
 * only live announcements targeting them ('all', their college, their org).
 */
export default async function AnnouncementsPage() {
  const profile = await getProfile();
  const isOsa = profile?.role === 'osa_admin' || profile?.role === 'super_admin';

  const supabase = await createClient();

  const [{ data: announcements }, { data: colleges }, { data: organizations }] =
    await Promise.all([
      supabase
        .from('announcements')
        .select(
          'id, title, body, target_type, is_pinned, expires_at, attachment_file_name, created_at'
        )
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      isOsa
        ? supabase.from('colleges').select('id, name').order('name')
        : Promise.resolve({ data: [] }),
      isOsa
        ? supabase.from('organizations').select('id, name').order('name')
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="OSA bulletins for the whole community, a college, or a single organization. Targeted announcements notify only the people they reach."
      />

      <Card>
        <CardContent className="py-6">
          <AnnouncementBoard
            announcements={(announcements ?? []) as AnnouncementRow[]}
            isOsa={isOsa}
            colleges={(colleges ?? []).map((row) => ({
              id: row.id,
              label: row.name,
            }))}
            organizations={(organizations ?? []).map((row) => ({
              id: row.id,
              label: row.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
