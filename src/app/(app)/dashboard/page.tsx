import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireProfile } from '@/lib/auth';
import { loadDashboard, type DashboardItem } from '@/lib/dashboard';
import { ROLE_LABELS, STATUS_LABELS, STATUS_TONE, roleBadgeVariant } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { cn } from 'cn';

/**
 * Phase 6 dashboard - a thin renderer over `loadDashboard()`, which holds all
 * of the queries and role rules. Officers, advisers and OSA each get their own
 * KPI set, attention queue and (RLS-scoped) status matrix.
 */

const KPI_TONE: Record<string, string> = {
  default: '',
  warning: 'text-amber-600',
  danger: 'text-destructive',
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function AttentionList({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        Nothing to show right now.
      </p>
    );
  }
  return (
    <div className="divide-y">
      {items.map((item, index) => (
        <Link
          key={`${item.href}-${index}`}
          href={item.href}
          className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
          </div>
          <Badge
            className={cn('shrink-0 border-transparent', item.badgeClass)}
            variant="outline"
          >
            {item.badge}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const data = await loadDashboard(profile, supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${profile.full_name.split(' ')[0]}`}
        description={
          data.schoolYearName
            ? `${ROLE_LABELS[profile.role]} · School year ${data.schoolYearName}`
            : ROLE_LABELS[profile.role]
        }
      >
        <Badge variant={roleBadgeVariant(profile.role)}>
          {ROLE_LABELS[profile.role]}
        </Badge>
      </PageHeader>

      {denied ? (
        <Alert>
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            Your account does not have permission to open that page. Ask the
            Office of Student Affairs if you think this is a mistake.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle
                className={cn(
                  'text-2xl tabular-nums',
                  KPI_TONE[kpi.tone] ?? ''
                )}
              >
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              {kpi.hint}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{data.attention.title}</CardTitle>
            <CardDescription>{data.attention.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.attention.items.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                {data.attention.emptyMessage}
              </p>
            ) : (
              <AttentionList items={data.attention.items} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Submissions by status</CardTitle>
            <CardDescription>
              {data.schoolYearName
                ? `School year ${data.schoolYearName} · ${data.matrix.grandTotal} records in your scope`
                : `${data.matrix.grandTotal} records in your scope`}
            </CardDescription>
            {data.audience === 'osa' ? (
              <CardDescription>
                See{' '}
                <Link href="/osa/reports" className="underline hover:text-foreground">
                  Reports &amp; Exports
                </Link>{' '}
                for the per-college summary and the Excel / PDF downloads.
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  {data.matrix.modules.map((module) => (
                    <TableHead key={module.key} className="text-right">
                      {module.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.matrix.statuses.map((status, statusIndex) => (
                  <TableRow key={status}>
                    <TableCell>
                      <Badge
                        className={cn('border-transparent', STATUS_TONE[status])}
                        variant="outline"
                      >
                        {STATUS_LABELS[status]}
                      </Badge>
                    </TableCell>
                    {data.matrix.modules.map((module, moduleIndex) => (
                      <TableCell
                        key={module.key}
                        className="text-right tabular-nums text-sm"
                      >
                        {data.matrix.counts[statusIndex][moduleIndex] || (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-medium">
                      {data.matrix.counts[statusIndex].reduce((a, b) => a + b, 0) || (
                        <span className="font-normal text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  {data.matrix.totals.map((total, index) => (
                    <TableCell key={index} className="text-right tabular-nums">
                      {total}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {data.matrix.grandTotal}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data.recent.title}</CardTitle>
          <CardDescription>{data.recent.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {data.recent.emptyMessage}
            </p>
          ) : (
            <AttentionList items={data.recent.items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
