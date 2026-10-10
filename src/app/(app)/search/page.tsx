import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/labels';
import { formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { Search } from 'lucide-react';

type SearchResult = {
  href: string;
  title: string;
  meta: string;
  badge?: string;
  tone?: string;
};

/** Keeps user input out of PostgREST filter syntax (%, commas, parens). */
function sanitize(raw: string): string {
  return raw.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

/**
 * Global search (Phase 8). One query box across every module the caller's
 * RLS already scopes - proposals, reports, audit documents, other documents,
 * organizations and announcements. Nothing is indexed: each section runs a
 * bounded ILIKE, so results always respect live permissions.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQuery } = await searchParams;
  const q = sanitize(rawQuery ?? '');
  const active = q.length >= 2;
  const pattern = `%${q}%`;

  const supabase = await createClient();

  const [
    proposalsResult,
    reportsResult,
    auditResult,
    documentsResult,
    organizationsResult,
    announcementsResult,
  ] = await Promise.all([
    active
      ? supabase
          .from('activity_proposals')
          .select('id, reference_number, title, status, activity_date')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from('accomplishment_reports')
          .select('id, reference_number, title, status, created_at')
          .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from('audit_documents')
          .select('id, reference_number, title, status, doc_type')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from('other_documents')
          .select('id, reference_number, title, status, category')
          .or(`title.ilike.${pattern},description.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from('organizations')
          .select('id, code, name')
          .or(`name.ilike.${pattern},code.ilike.${pattern}`)
          .order('name')
          .limit(10)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from('announcements')
          .select('id, title, body')
          .or(`title.ilike.${pattern},body.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const sections: { heading: string; items: SearchResult[] }[] = [];

  const proposals = (proposalsResult.data ?? []) as {
    id: string;
    reference_number: string;
    title: string;
    status: string;
    activity_date: string | null;
  }[];
  if (proposals.length > 0) {
    sections.push({
      heading: 'Activity proposals',
      items: proposals.map((row) => ({
        href: `/proposals/${row.id}`,
        title: row.title,
        meta: `${row.reference_number} · ${formatDate(row.activity_date)}`,
        badge: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
        tone: STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? '',
      })),
    });
  }

  const reports = (reportsResult.data ?? []) as {
    id: string;
    reference_number: string;
    title: string;
    status: string;
    created_at: string;
  }[];
  if (reports.length > 0) {
    sections.push({
      heading: 'Accomplishment reports',
      items: reports.map((row) => ({
        href: `/reports/${row.id}`,
        title: row.title,
        meta: `${row.reference_number} · ${formatDate(row.created_at)}`,
        badge: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
        tone: STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? '',
      })),
    });
  }

  const auditDocs = (auditResult.data ?? []) as {
    id: string;
    reference_number: string;
    title: string;
    status: string;
  }[];
  if (auditDocs.length > 0) {
    sections.push({
      heading: 'Audit documents',
      items: auditDocs.map((row) => ({
        href: `/audit-documents/${row.id}`,
        title: row.title,
        meta: row.reference_number,
        badge: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
        tone: STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? '',
      })),
    });
  }

  const otherDocs = (documentsResult.data ?? []) as {
    id: string;
    reference_number: string;
    title: string;
    status: string;
  }[];
  if (otherDocs.length > 0) {
    sections.push({
      heading: 'Other documents',
      items: otherDocs.map((row) => ({
        href: `/documents/${row.id}`,
        title: row.title,
        meta: row.reference_number,
        badge: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
        tone: STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? '',
      })),
    });
  }

  const orgs = (organizationsResult.data ?? []) as {
    id: string;
    code: string;
    name: string;
  }[];
  if (orgs.length > 0) {
    sections.push({
      heading: 'Organizations',
      items: orgs.map((row) => ({
        href: `/organizations/${row.id}`,
        title: row.name,
        meta: row.code,
      })),
    });
  }

  const announcementRows = (announcementsResult.data ?? []) as {
    id: string;
    title: string;
    body: string;
  }[];
  if (announcementRows.length > 0) {
    sections.push({
      heading: 'Announcements',
      items: announcementRows.map((row) => ({
        href: '/announcements',
        title: row.title,
        meta: row.body.slice(0, 160),
      })),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="One box across proposals, reports, documents, organizations and announcements - results respect your permissions."
      />

      <form action="/search" method="get" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={rawQuery ?? ''}
          placeholder="Search SOMS…"
          aria-label="Search SOMS"
          className="h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Search className="size-4" /> Search
        </button>
      </form>

      {!active ? (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches for &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {section.heading} ({section.items.length})
              </h2>
              <ul className="divide-y rounded-lg border">
                {section.items.map((item) => (
                  <li key={`${section.heading}-${item.href}-${item.title}`}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.meta}
                        </p>
                      </div>
                      {item.badge ? (
                        <Badge
                          className={`shrink-0 border-transparent ${item.tone ?? ''}`}
                          variant="outline"
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
