import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { ProposalForm } from '@/components/proposals/proposal-form';
import { StatusBadge } from '@/components/submissions/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import type { SubmissionStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { listVenueOptions } from '@/lib/venues';

const EDITABLE: SubmissionStatus[] = ['draft', 'revision_requested'];

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('activity_proposals')
    .select('*, organizations(name, code)')
    .eq('id', id)
    .maybeSingle();

  if (!proposal) notFound();

  const venues = await listVenueOptions(supabase, { keepId: proposal.venue_id });

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const allowed =
    EDITABLE.includes(proposal.status) &&
    (proposal.created_by === profile.id || isOsa);

  // RLS would reject the write anyway - redirect early with a friendly path.
  if (!allowed) redirect(`/proposals/${proposal.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit proposal"
        description={`${proposal.reference_number} · ${
          proposal.organizations?.name ?? ''
        }`}
      >
        <StatusBadge status={proposal.status} />
        <Link
          href={`/proposals/${proposal.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft /> Back to proposal
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <ProposalForm
            mode="edit"
            venues={venues}
            proposal={{
              id: proposal.id,
              title: proposal.title,
              description: proposal.description ?? undefined,
              objectives: proposal.objectives ?? undefined,
              activity_date: proposal.activity_date,
              start_time: proposal.start_time ?? undefined,
              end_time: proposal.end_time ?? undefined,
              venue: proposal.venue,
              venue_id: proposal.venue_id ?? undefined,
              participants_count: proposal.participants_count,
              budget: proposal.budget,
              source_of_funds: proposal.source_of_funds ?? undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
