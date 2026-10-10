import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import {
  ReportForm,
  type ApprovedActivityOption,
} from '@/components/reports/report-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function NewReportPage() {
  const profile = await requireRole('officer');
  if (!profile.organization_id) redirect('/dashboard?denied=1');

  const supabase = await createClient();
  const [{ data: organization }, { data: schoolYear }, { data: proposals }] =
    await Promise.all([
      supabase
        .from('organizations')
        .select('name, code')
        .eq('id', profile.organization_id)
        .maybeSingle(),
      supabase
        .from('school_years')
        .select('id, name')
        .eq('is_current', true)
        .maybeSingle(),
      supabase
        .from('activity_proposals')
        .select('id, title, reference_number, activity_date')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'approved')
        .order('activity_date', { ascending: false }),
    ]);

  const activities: ApprovedActivityOption[] = (proposals ?? []).map(
    (proposal) => ({
      id: proposal.id,
      label: `${proposal.reference_number ?? proposal.id.slice(0, 8)} · ${
        proposal.title
      }${proposal.activity_date ? ` (${proposal.activity_date})` : ''}`,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="New accomplishment report"
        description={
          organization
            ? `${organization.name} (${organization.code}) · School year ${
                schoolYear?.name ?? '—'
              }`
            : 'Organization officers only'
        }
      />

      {!schoolYear ? (
        <Alert variant="destructive">
          <AlertTitle>No current school year</AlertTitle>
          <AlertDescription>
            A report must belong to a school year. Ask an administrator to set
            the current school year first.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ReportForm mode="create" activities={activities} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
