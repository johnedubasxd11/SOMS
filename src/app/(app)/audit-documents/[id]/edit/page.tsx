import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { AuditDocumentForm } from '@/components/audit-documents/audit-document-form';
import { StatusBadge } from '@/components/submissions/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import type { SubmissionStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

const EDITABLE: SubmissionStatus[] = ['draft', 'revision_requested'];

export default async function EditAuditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: document } = await supabase
    .from('audit_documents')
    .select('*, organizations(name, code)')
    .eq('id', id)
    .maybeSingle();

  if (!document) notFound();

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const allowed =
    EDITABLE.includes(document.status) &&
    (document.created_by === profile.id || isOsa);

  // RLS would reject the write anyway - redirect early with a friendly path.
  if (!allowed) redirect(`/audit-documents/${document.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit audit document"
        description={`${document.reference_number} · ${
          document.organizations?.name ?? ''
        }`}
      >
        <StatusBadge status={document.status} />
        <Link
          href={`/audit-documents/${document.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft /> Back to document
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <AuditDocumentForm
            mode="edit"
            document={{
              id: document.id,
              title: document.title,
              description: document.description ?? undefined,
              doc_type: document.doc_type,
              semester: document.semester,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
