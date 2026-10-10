import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { EditOrganizationDialog } from '@/components/organizations/edit-organization-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/server';
import { ACCREDITATION_LABELS } from '@/lib/validations/organizations';

const ACCREDITATION_TONE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  accredited: 'bg-emerald-500/15 text-emerald-700',
  conditional: 'bg-amber-500/15 text-amber-700',
  not_accredited: 'bg-destructive/15 text-destructive',
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('*, colleges(id, name, code)')
    .eq('id', id)
    .maybeSingle();

  if (!org) notFound();

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_current', true)
    .maybeSingle();

  let summary: {
    total_proposals: number | null;
    approved_proposals: number | null;
    pending_proposals: number | null;
    rejected_proposals: number | null;
    approved_budget: number | null;
    total_reports: number | null;
    total_audit_documents: number | null;
    total_requirements: number | null;
    open_requirements: number | null;
    overdue_requirements: number | null;
  } | null = null;
  let advisers: {
    id: string;
    is_active: boolean;
    profiles: { id: string; full_name: string; email: string; position: string | null } | null;
  }[] = [];
  let officers: {
    id: string;
    position: string;
    is_active: boolean;
    profiles: { id: string; full_name: string; email: string } | null;
  }[] = [];

  if (schoolYear) {
    const { data: summaryRow } = await supabase
      .from('v_organization_summary')
      .select(
        'total_proposals, approved_proposals, pending_proposals, rejected_proposals, approved_budget, total_reports, total_audit_documents, total_requirements, open_requirements, overdue_requirements'
      )
      .eq('organization_id', org.id)
      .eq('school_year_id', schoolYear.id)
      .maybeSingle();
    summary = summaryRow;

    const { data: adviserRows } = await supabase
      .from('advisers')
      .select(
        'id, is_active, profiles(id, full_name, email, position)'
      )
      .eq('organization_id', org.id)
      .eq('school_year_id', schoolYear.id)
      .eq('is_active', true);
    advisers = adviserRows ?? [];

    const { data: officerRows } = await supabase
      .from('organization_officers')
      .select('id, position, is_active, profiles(id, full_name, email)')
      .eq('organization_id', org.id)
      .eq('school_year_id', schoolYear.id)
      .eq('is_active', true)
      .order('position');
    officers = officerRows ?? [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={`${org.code} · ${org.colleges?.name ?? 'Unknown college'}`}
      >
        <Badge
          variant="outline"
          className={cn(
            'border-transparent',
            ACCREDITATION_TONE[org.accreditation_status]
          )}
        >
          {ACCREDITATION_LABELS[
            org.accreditation_status as keyof typeof ACCREDITATION_LABELS
          ] ?? org.accreditation_status}
        </Badge>
        {!org.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
        {isOsa ? (
          <EditOrganizationDialog
            organization={{
              id: org.id,
              name: org.name,
              code: org.code,
              description: org.description,
              accreditation_status: org.accreditation_status,
              accreditation_valid_until: org.accreditation_valid_until,
              membership_count: org.membership_count,
              is_active: org.is_active,
            }}
          />
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Record</CardTitle>
            <CardDescription>Official organization details.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <DetailRow label="College" value={org.colleges?.name} />
            <DetailRow
              label="Accreditation"
              value={
                ACCREDITATION_LABELS[
                  org.accreditation_status as keyof typeof ACCREDITATION_LABELS
                ] ?? org.accreditation_status
              }
            />
            <DetailRow
              label="Valid until"
              value={org.accreditation_valid_until ?? '—'}
            />
            <DetailRow label="Members" value={org.membership_count} />
            <DetailRow
              label="Status"
              value={org.is_active ? 'Active' : 'Inactive'}
            />
            <DetailRow
              label="Description"
              value={
                <span className="max-w-56 text-right text-sm font-normal text-muted-foreground">
                  {org.description ?? '—'}
                </span>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This school year</CardTitle>
            <CardDescription>
              {schoolYear ? `School year ${schoolYear.name}` : 'No current school year'}
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <DetailRow
              label="Proposals"
              value={
                summary
                  ? `${summary.approved_proposals} approved / ${summary.total_proposals}`
                  : '—'
              }
            />
            <DetailRow
              label="Awaiting action"
              value={summary?.pending_proposals ?? '—'}
            />
            <DetailRow
              label="Rejected"
              value={summary?.rejected_proposals ?? '—'}
            />
            <DetailRow label="Reports" value={summary?.total_reports ?? '—'} />
            <DetailRow
              label="Audit documents"
              value={summary?.total_audit_documents ?? '—'}
            />
            <DetailRow
              label="Approved budget"
              value={
                summary
                  ? `₱${Number(summary.approved_budget).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                    })}`
                  : '—'
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Faculty adviser</CardTitle>
              <CardDescription>
                {schoolYear ? `School year ${schoolYear.name}` : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {advisers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No adviser assigned for this school year.
                </p>
              ) : (
                <ul className="space-y-2">
                  {advisers.map((adviser) => (
                    <li key={adviser.id} className="text-sm">
                      <p className="font-medium">
                        {adviser.profiles?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {adviser.profiles?.position ?? 'Faculty adviser'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Officers</CardTitle>
              <CardDescription>
                {schoolYear ? `School year ${schoolYear.name}` : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {officers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No officers recorded for this school year.
                </p>
              ) : (
                <ul className="divide-y">
                  {officers.map((officer) => (
                    <li
                      key={officer.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {officer.position}
                      </span>
                      <span className="truncate font-medium">
                        {officer.profiles?.full_name ?? 'Unknown'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
