import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { AuditDocumentForm } from '@/components/audit-documents/audit-document-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function NewAuditDocumentPage() {
  const profile = await requireRole('officer');
  if (!profile.organization_id) redirect('/dashboard?denied=1');

  const supabase = await createClient();
  const [{ data: organization }, { data: schoolYear }] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New audit document"
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
            A document must belong to a school year. Ask an administrator to
            set the current school year first.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <AuditDocumentForm mode="create" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
