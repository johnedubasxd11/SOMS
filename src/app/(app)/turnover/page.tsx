import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { currentSchoolYear } from '@/lib/actions/shared';
import { createClient } from '@/lib/supabase/server';
import {
  TurnoverEditor,
  type TermRow,
  type TurnoverMember,
} from '@/components/turnover/turnover-editor';

export default async function TurnoverPage() {
  const profile = await requireProfile();
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';

  if (profile.role !== 'officer' || !profile.organization_id) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Officer turnover"
          description="Submit the incoming officer list for OSA approval."
        />
        <p className="text-sm text-muted-foreground">
          {isOsa
            ? 'Organizations submit their officer lists here - review them under Turnover Review.'
            : 'Only organization officers manage the officer list. Your account is not linked to an organization.'}
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);

  if (!schoolYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Officer turnover"
          description="Submit the incoming officer list for OSA approval."
        />
        <p className="text-sm text-muted-foreground">
          No current school year is configured - ask an administrator to set one.
        </p>
      </div>
    );
  }

  const { data: term } = await supabase
    .from('officer_terms')
    .select(
      `id, status, notes, submitted_at,
       members:officer_term_members(full_name, position, email, sort_order)`
    )
    .eq('organization_id', profile.organization_id)
    .eq('school_year_id', schoolYear.id)
    .maybeSingle();

  const members: TurnoverMember[] = (
    ((term?.members ?? []) as Array<{
      full_name: string;
      position: string;
      email: string | null;
      sort_order: number;
    }>)
  )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ full_name: m.full_name, position: m.position, email: m.email ?? '' }));

  const row: TermRow | null = term
    ? {
        id: term.id,
        status: term.status as TermRow['status'],
        notes: term.notes,
        submitted_at: term.submitted_at,
        members,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Officer turnover"
        description={`Type the incoming officer list for school year ${schoolYear.name} and submit it for OSA approval.`}
      />
      <Card>
        <CardContent className="pt-6">
          <TurnoverEditor term={row} />
        </CardContent>
      </Card>
    </div>
  );
}
