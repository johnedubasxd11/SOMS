import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TemplateManager } from '@/components/admin/template-manager';
import { requireOsa } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * OSA template library (Phase 7). Every version row is listed - the manager
 * groups them by name, keeps History downloadable, and supersedes through
 * the versioned upload action.
 */
export default async function OsaTemplatesPage() {
  await requireOsa();

  const supabase = await createClient();
  const { data } = await supabase
    .from('templates')
    .select(
      'id, name, description, category, file_name, size_bytes, version, is_active, parent_id, created_at'
    )
    .order('name')
    .order('version', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template library"
        description="Upload the blank forms every organization downloads. Uploading the same name again supersedes the old version - it is never overwritten."
      />

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            The public board at /templates shows only the active version of
            each name; History keeps every previous file downloadable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateManager templates={(data ?? []) as never} />
        </CardContent>
      </Card>
    </div>
  );
}
