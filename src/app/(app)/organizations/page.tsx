import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireProfile } from '@/lib/auth';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/server';
import {
  ACCREDITATION_LABELS,
  type ACCREDITATION_STATUSES,
} from '@/lib/validations/organizations';

const ACCREDITATION_TONE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  accredited: 'bg-emerald-500/15 text-emerald-700',
  conditional: 'bg-amber-500/15 text-amber-700',
  not_accredited: 'bg-destructive/15 text-destructive',
};

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile();

  const { q } = await searchParams;
  const query = sanitize(q ?? '');

  const supabase = await createClient();
  let builder = supabase
    .from('organizations')
    .select(
      'id, code, name, accreditation_status, membership_count, is_active, colleges(name, code)'
    )
    .order('name');

  if (query) {
    builder = builder.or(`name.ilike.%${query}%,code.ilike.%${query}%`);
  }

  const { data: organizations } = await builder;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Student organizations recognized by the Office of Student Affairs."
      />

      <form method="get" className="flex max-w-xs gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or code"
          aria-label="Search organizations"
        />
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Accreditation</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!organizations || organizations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {query ? 'No organization matches your search.' : 'No organizations yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-mono text-xs">{org.code}</TableCell>
                    <TableCell>
                      <Link
                        href={`/organizations/${org.id}`}
                        className="font-medium hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.colleges?.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent',
                          ACCREDITATION_TONE[org.accreditation_status]
                        )}
                      >
                        {ACCREDITATION_LABELS[
                          org.accreditation_status as (typeof ACCREDITATION_STATUSES)[number]
                        ] ?? org.accreditation_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {org.membership_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={org.is_active ? 'secondary' : 'outline'}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
