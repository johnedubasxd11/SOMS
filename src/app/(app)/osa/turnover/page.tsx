import { PageHeader } from '@/components/layout/page-header';
import { requireOsa } from '@/lib/auth';
import { currentSchoolYear } from '@/lib/actions/shared';
import { createClient } from '@/lib/supabase/server';
import {
  TurnoverReviewQueue,
  type TurnoverReviewRow,
} from '@/components/admin/turnover-review';

export default async function OsaTurnoverPage() {
  await requireOsa();

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);

  if (!schoolYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Turnover review"
          description="Approve or send back officer lists submitted by organizations."
        />
        <p className="text-sm text-muted-foreground">
          No current school year is configured - set one under School years first.
        </p>
      </div>
    );
  }

  const { data: terms } = await supabase
    .from('officer_terms')
    .select(
      `id, status, notes, submitted_at, reviewed_at, organization_id,
       organization:organizations(name),
       members:officer_term_members(full_name, position, email, sort_order)`
    )
    .eq('school_year_id', schoolYear.id)
    .neq('status', 'approved')
    .order('submitted_at', { ascending: true, nullsFirst: true });

  const rows: TurnoverReviewRow[] = ((terms ?? []) as Array<{
    id: string;
    status: TurnoverReviewRow['status'];
    notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    organization_id: string;
    organization: { name: string } | null;
    members: {
      full_name: string;
      position: string;
      email: string | null;
      sort_order: number;
    }[] | null;
  }>).map((term) => ({
    id: term.id,
    status: term.status,
    notes: term.notes,
    submitted_at: term.submitted_at,
    reviewed_at: term.reviewed_at,
    organization_id: term.organization_id,
    organization_name: term.organization?.name ?? 'Unknown organization',
    members: (term.members ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        full_name: m.full_name,
        position: m.position,
        email: m.email,
      })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turnover review"
        description={`Officer lists for school year ${schoolYear.name} - approve or send back with notes.`}
      />
      <TurnoverReviewQueue rows={rows} />
    </div>
  );
}
