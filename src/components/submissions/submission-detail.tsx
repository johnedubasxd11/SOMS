import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import {
  ApprovalChain,
  type ApprovalChainStep,
} from '@/components/submissions/approval-chain';
import { Attachments } from '@/components/submissions/attachments';
import { ReviewTimeline } from '@/components/submissions/review-timeline';
import { StatusBadge } from '@/components/submissions/status-badge';
import { SubmissionActions } from '@/components/submissions/submission-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { APPROVAL_STEP_ROLE_LABELS, type SubmissionStatus } from '@/lib/labels';
import { getModule, submissionPermissions, type PendingStep } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type ProposalRow = Database['public']['Views']['v_activity_proposal_list']['Row'];
type ReportRow = Database['public']['Views']['v_accomplishment_report_list']['Row'];
type OtherDocumentRow = Database['public']['Views']['v_other_document_list']['Row'];
type AuditDocumentRow = Database['public']['Views']['v_audit_document_list']['Row'];

/**
 * The detail row every module shares (the proposal view is the widest, the
 * other views contribute their extra columns as optionals).
 */
export type SubmissionDetailRow = ProposalRow &
  Partial<ReportRow> &
  Partial<OtherDocumentRow> &
  Partial<AuditDocumentRow>;

const EDITABLE: SubmissionStatus[] = ['draft', 'revision_requested'];

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export { Detail };

/**
 * The detail page body shared by every submission module: header, revision
 * alert, module-specific fields (via `renderDetails`), attachments, review
 * timeline, workflow status and the role-aware action card.
 */
export async function SubmissionDetail({
  moduleKey,
  id,
  detailsTitle,
  detailsDescription,
  renderDetails,
}: {
  moduleKey: string;
  id: string;
  detailsTitle: string;
  detailsDescription?: string;
  renderDetails: (row: SubmissionDetailRow) => React.ReactNode;
}) {
  const mod = getModule(moduleKey);
  if (!mod) throw new Error(`Unknown submission module: ${moduleKey}`);

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from(mod.view)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const row = data as SubmissionDetailRow | null;
  if (!row?.id) notFound();

  const status = row.status ?? 'draft';
  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const version = row.version ?? 1;

  const [logsResult, filesResult, adviserResult, pendingResult, chainResult, orgResult, configResult] =
    await Promise.all([
      supabase
        .from('review_logs')
        .select(
          'id, from_status, to_status, action, remarks, actor_name, actor_role, created_at'
        )
        .eq('record_type', mod.recordType)
        .eq('record_id', row.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('documents')
        .select(
          'id, file_name, mime_type, size_bytes, uploaded_by, version, parent_id, is_active, created_at, uploader:profiles(full_name)'
        )
        .eq('record_type', mod.recordType)
        .eq('record_id', row.id)
        .order('created_at', { ascending: true }),
      row.organization_id
        ? supabase.rpc('is_adviser_of', {
            p_organization_id: row.organization_id,
          })
        : Promise.resolve({ data: false }),
      supabase
        .from('approval_records')
        .select('step_number, step_role')
        .eq('record_type', mod.recordType)
        .eq('record_id', row.id)
        .eq('version', version)
        .eq('status', 'pending')
        .order('step_number', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('approval_records')
        .select(
          'step_number, step_role, status, acted_at, remarks, acted_by_profile:profiles(full_name)'
        )
        .eq('record_type', mod.recordType)
        .eq('record_id', row.id)
        .eq('version', version)
        .order('step_number', { ascending: true }),
      row.organization_id
        ? supabase
            .from('organizations')
            .select('college_id')
            .eq('id', row.organization_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('approval_chains')
        .select('name, steps:approval_chain_steps(step_number, step_role)')
        .eq('record_type', mod.recordType)
        .maybeSingle(),
    ]);

  const pendingStep = (pendingResult.data ?? null) as PendingStep | null;
  const permissions = submissionPermissions(
    profile,
    {
      status,
      organization_id: row.organization_id,
      created_by: row.created_by,
    },
    {
      isAdviser: Boolean(adviserResult.data),
      pendingStep,
      collegeId: orgResult.data?.college_id ?? null,
    }
  );

  const configured = configResult.data;
  const recordSteps = chainResult.data ?? [];
  const chainSteps: ApprovalChainStep[] =
    status !== 'draft' && recordSteps.length > 0
      ? recordSteps.map((step) => ({
          step_number: step.step_number,
          step_role: step.step_role,
          status: step.status,
          acted_at: step.acted_at,
          actor_name: step.acted_by_profile?.full_name ?? null,
          remarks: step.remarks,
        }))
      : (configured?.steps ?? []).map((step) => ({
          step_number: step.step_number,
          step_role: step.step_role,
          status: 'upcoming' as const,
        }));

  const editable = EDITABLE.includes(status);

  // Attachments are versioned, never overwritten: every upload of the same
  // logical file links to its predecessor (parent_id) and the newest version
  // is the only active one. Group the rows into chains so the screen shows
  // one entry per file with its history still downloadable.
  const documentRows = filesResult.data ?? [];
  const parentIds = new Set(
    documentRows
      .map((file) => file.parent_id)
      .filter((id): id is string => Boolean(id))
  );

  const toVersion = (file: (typeof documentRows)[number]) => ({
    id: file.id,
    file_name: file.file_name,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
    uploaded_by: file.uploaded_by,
    uploader_name: file.uploader?.full_name ?? null,
    version: file.version ?? 1,
    created_at: file.created_at,
  });

  const files = documentRows
    .filter((file) => !parentIds.has(file.id))
    .map((head) => {
      const history: ReturnType<typeof toVersion>[] = [];
      let cursor = head.parent_id
        ? documentRows.find((candidate) => candidate.id === head.parent_id)
        : undefined;
      while (cursor) {
        history.push(toVersion(cursor));
        cursor = cursor.parent_id
          ? documentRows.find((candidate) => candidate.id === cursor!.parent_id)
          : undefined;
      }
      return { ...toVersion(head), history };
    })
    .sort((a, b) => a.file_name.localeCompare(b.file_name));

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.title ?? mod.label}
        description={`${row.reference_number ?? ''} · ${
          row.organization_name ?? '—'
        } · School year ${row.school_year_name ?? '—'}`}
      >
        <StatusBadge status={status} />
        {permissions.canEdit ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`${mod.basePath}/${row.id}/edit`}>
              <Pencil /> Edit draft
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {(status === 'revision_requested' || status === 'rejected') &&
      row.reviewer_remarks ? (
        <Alert variant="destructive">
          <AlertTitle>
            {status === 'rejected' ? 'Rejected' : 'Revision requested'}
          </AlertTitle>
          <AlertDescription>{row.reviewer_remarks}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{detailsTitle}</CardTitle>
              <CardDescription>{detailsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">{renderDetails(row)}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>
                Supporting files (PDF, DOC, XLS, JPG or PNG - 10 MB each).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Attachments
                recordId={row.id}
                moduleKey={mod.key}
                files={files}
                canUpload={permissions.canAttach}
                isOsa={isOsa}
                currentUserId={profile.id}
                editable={editable}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review timeline</CardTitle>
              <CardDescription>
                Every status change and remark, newest last.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewTimeline entries={logsResult.data ?? []} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval chain</CardTitle>
              <CardDescription>
                Who signs off before this record is approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalChain
                name={configured?.name ?? 'Approval chain'}
                steps={chainSteps}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow status</CardTitle>
              <CardDescription>Version {version}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Current status</span>
                <StatusBadge status={status} />
              </div>
              {pendingStep && status !== 'draft' ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Waiting on</span>
                  <span>
                    {APPROVAL_STEP_ROLE_LABELS[pendingStep.step_role] ??
                      pendingStep.step_role}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(row.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Submitted</span>
                <span>{formatDateTime(row.submitted_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Endorsed</span>
                <span>{formatDateTime(row.endorsed_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Reviewed</span>
                <span>{formatDateTime(row.reviewed_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Approved</span>
                <span>{formatDateTime(row.approved_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Hardcopy</span>
                <span>
                  {row.hardcopy_received
                    ? `Received ${formatDate(row.hardcopy_received_at)}`
                    : 'Awaiting paper copy'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Only the actions your role may perform are shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubmissionActions
                recordId={row.id}
                moduleKey={mod.key}
                noun={mod.noun}
                permissions={permissions}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
