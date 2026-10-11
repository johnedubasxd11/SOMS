import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { currentSchoolYear } from '@/lib/actions/shared';
import { createClient } from '@/lib/supabase/server';
import {
  ChecklistView,
  type ChecklistItemRow,
} from '@/components/accreditation/checklist-view';
import type { AccreditationSubmissionStatus } from '@/lib/labels';

export default async function AccreditationPage() {
  const profile = await requireProfile();
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);

  if (!schoolYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accreditation"
          description="Upload the files OSA needs to accredit your organization."
        />
        <p className="text-sm text-muted-foreground">
          No current school year is configured - ask an administrator to set one.
        </p>
      </div>
    );
  }

  if (!profile.organization_id) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accreditation"
          description="Upload the files OSA needs to accredit your organization."
        />
        <p className="text-sm text-muted-foreground">
          Your account is not linked to an organization - nothing to upload.
        </p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from('accreditation_items')
    .select(
      `id, title, description, sort_order, is_required,
       submissions:accreditation_submissions(
         id, status, file_name, remarks, organization_id
       )`
    )
    .eq('school_year_id', schoolYear.id)
    .order('sort_order')
    .order('title');

  const rows: ChecklistItemRow[] = ((items ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    is_required: boolean;
    submissions: {
      id: string;
      status: AccreditationSubmissionStatus;
      file_name: string;
      remarks: string | null;
      organization_id: string;
    }[] | null;
  }>).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    sort_order: item.sort_order,
    is_required: item.is_required,
    submission:
      item.submissions?.find((s) => s.organization_id === profile.organization_id) ??
      null,
  }));

  const uploaded = rows.filter((r) => r.submission).length;
  const approved = rows.filter((r) => r.submission?.status === 'approved').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accreditation"
        description={
          isOsa
            ? 'Every organization uploads one file per checklist item for the current school year. Manage the checklist under Accreditation Review.'
            : 'Upload the files OSA needs to accredit your organization this school year.'
        }
      />

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">
          Checklist items: <span className="font-medium text-foreground">{rows.length}</span>
        </span>
        <span className="text-muted-foreground">
          Uploaded: <span className="font-medium text-foreground">{uploaded}</span>
        </span>
        <span className="text-muted-foreground">
          Approved: <span className="font-medium text-foreground">{approved}</span>
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ChecklistView items={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
