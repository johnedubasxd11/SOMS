import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getProfile } from '@/lib/auth';
import { formatBytes, formatDate } from '@/lib/format';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { Download } from 'lucide-react';

type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  file_name: string;
  size_bytes: number;
  version: number;
  created_at: string;
};

/**
 * Public template board (Phase 7). Every signed-in user sees the latest
 * active version of every template - RLS on `templates` is open for reads,
 * so the query is a plain select filtered to is_active.
 */
export default async function TemplatesPage() {
  const profile = await getProfile();
  const isOsa = profile?.role === 'osa_admin' || profile?.role === 'super_admin';

  const supabase = await createClient();
  const { data } = await supabase
    .from('templates')
    .select(
      'id, name, description, category, file_name, size_bytes, version, created_at'
    )
    .eq('is_active', true)
    .order('category')
    .order('name');

  const templates = (data ?? []) as TemplateListItem[];
  const groups = TEMPLATE_CATEGORIES.map((category) => ({
    category,
    rows: templates.filter((row) => row.category === category),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Form templates"
        description="Official OSA blank forms - always the latest version. Older versions stay downloadable from the OSA template library."
      >
        {isOsa ? (
          <Button asChild>
            <a href="/osa/templates">Manage templates</a>
          </Button>
        ) : null}
      </PageHeader>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-sm text-muted-foreground">
              No templates published yet - check back with OSA.
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle>{TEMPLATE_CATEGORY_LABELS[group.category]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    {row.description ? (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {row.file_name} · {formatBytes(row.size_bytes)} · updated{' '}
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">v{row.version}</Badge>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/templates/${row.id}`}>
                        <Download /> Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
