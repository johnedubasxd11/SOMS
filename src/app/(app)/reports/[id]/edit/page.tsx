import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import {
  ReportForm,
  type ApprovedActivityOption,
} from '@/components/reports/report-form';
import { StatusBadge } from '@/components/submissions/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import type { SubmissionStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

const EDITABLE: SubmissionStatus[] = ['draft', 'revision_requested'];

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: report } = await supabase
    .from('accomplishment_reports')
    .select('*, organizations(name, code)')
    .eq('id', id)
    .maybeSingle();

  if (!report) notFound();

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const allowed =
    EDITABLE.includes(report.status) &&
    (report.created_by === profile.id || isOsa);

  // RLS would reject the write anyway - redirect early with a friendly path.
  if (!allowed) redirect(`/reports/${report.id}`);

  const { data: proposals } = report.organization_id
    ? await supabase
        .from('activity_proposals')
        .select('id, title, reference_number, activity_date')
        .eq('organization_id', report.organization_id)
        .eq('status', 'approved')
        .order('activity_date', { ascending: false })
    : { data: null };

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
        title="Edit report"
        description={`${report.reference_number} · ${
          report.organizations?.name ?? ''
        }`}
      >
        <StatusBadge status={report.status} />
        <Link
          href={`/reports/${report.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft /> Back to report
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <ReportForm
            mode="edit"
            activities={activities}
            report={{
              id: report.id,
              title: report.title,
              summary: report.summary ?? undefined,
              outcomes: report.outcomes ?? undefined,
              attendance_count: report.attendance_count ?? 0,
              budget_spent: report.budget_spent ?? 0,
              liquidation_summary: report.liquidation_summary ?? undefined,
              proposal_id: report.proposal_id ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
