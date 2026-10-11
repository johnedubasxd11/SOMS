import { PageHeader } from '@/components/layout/page-header';
import { requireOsa } from '@/lib/auth';
import { currentSchoolYear } from '@/lib/actions/shared';
import { createClient } from '@/lib/supabase/server';
import {
  AccreditationManager,
  type ItemRow,
  type ReviewRow,
} from '@/components/admin/accreditation-manager';
import type {
  AccreditationSubmissionStatus,
} from '@/lib/labels';

export default async function OsaAccreditationPage() {
  await requireOsa();

  const supabase = await createClient();
  const schoolYear = await currentSchoolYear(supabase);

  if (!schoolYear) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accreditation review"
          description="Manage the per-year checklist and review organization uploads."
        />
        <p className="text-sm text-muted-foreground">
          No current school year is configured - set one under School years first.
        </p>
      </div>
    );
  }

  const [{ data: items }, { data: reviews }] = await Promise.all([
    supabase
      .from('accreditation_items')
      .select(
        `id, title, description, sort_order, is_required,
         accreditation_submissions(status)`
      )
      .eq('school_year_id', schoolYear.id)
      .order('sort_order')
      .order('title'),
    supabase
      .from('accreditation_submissions')
      .select(
        `id, status, file_name, remarks, submitted_at, organization_id,
         organization:organizations(name),
         item:accreditation_items!inner(title, school_year_id)`
      )
      .order('submitted_at', { ascending: false })
      .limit(200),
  ]);

  const itemRows: ItemRow[] = ((items ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    sort_order: number;
    is_required: boolean;
    accreditation_submissions: { status: string }[] | null;
  }>).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    sort_order: item.sort_order,
    is_required: item.is_required,
    upload_count: item.accreditation_submissions?.length ?? 0,
    pending_count:
      item.accreditation_submissions?.filter((s) => s.status === 'pending').length ?? 0,
  }));

  const allReviews = (reviews ?? []) as Array<{
    id: string;
    status: AccreditationSubmissionStatus;
    file_name: string;
    remarks: string | null;
    submitted_at: string;
    organization_id: string;
    organization: { name: string } | null;
    item: { title: string; school_year_id: string } | { title: string; school_year_id: string }[] | null;
  }>;

  const reviewRows: ReviewRow[] = allReviews
    .filter((row) => {
      const item = Array.isArray(row.item) ? row.item[0] : row.item;
      return item?.school_year_id === schoolYear.id;
    })
    .map((row) => {
      const item = Array.isArray(row.item) ? row.item[0] : row.item;
      return {
        id: row.id,
        status: row.status,
        file_name: row.file_name,
        remarks: row.remarks,
        submitted_at: row.submitted_at,
        organization_id: row.organization_id,
        organization_name: row.organization?.name ?? 'Unknown organization',
        item_title: item?.title ?? 'Unknown item',
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accreditation review"
        description={`Checklist and uploads for school year ${schoolYear.name}.`}
      />
      <AccreditationManager
        schoolYearId={schoolYear.id}
        items={itemRows}
        reviews={reviewRows}
      />
    </div>
  );
}
