import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { VenueManager } from '@/components/admin/venue-manager';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireOsa } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type ConflictRow = {
  proposal_id: string;
  reference_number: string;
  title: string;
  organization_name: string;
  conflicting_id: string;
  conflicting_reference: string;
  conflicting_title: string;
  conflicting_organization_name: string;
  venue_name: string;
  activity_date: string;
  overlap_start: string | null;
  overlap_end: string | null;
};

/**
 * OSA screen for Phase 4: the canonical venue list plus the register of every
 * overlapping booking the database can see (the same rules that refuse a
 * conflicting submit).
 */
export default async function VenuesPage() {
  await requireOsa();

  const supabase = await createClient();
  const [{ data: venues }, { data: conflicts }] = await Promise.all([
    supabase
      .from('venues')
      .select('id, name, location, capacity, is_active')
      .order('is_active', { ascending: false })
      .order('name'),
    supabase
      .from('v_venue_conflicts')
      .select('*')
      .order('activity_date', { ascending: false }),
  ]);

  const rows = (conflicts ?? []) as ConflictRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues & conflicts"
        description="The canonical venue list behind the proposal form, plus every double booking currently in the pipeline."
      />

      <Card>
        <CardHeader>
          <CardTitle>Booking conflicts</CardTitle>
          <CardDescription>
            Pairs of in-flight or approved proposals occupying the same venue
            slot. Officers are refused at submit time; OSA sees everything here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No overlapping bookings - every venue slot is free.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Venue</th>
                    <th className="px-3 py-2">Overlap</th>
                    <th className="px-3 py-2">Booking A</th>
                    <th className="px-3 py-2">Booking B</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={`${row.proposal_id}-${row.conflicting_id}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(row.activity_date)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.venue_name}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatTime(row.overlap_start)}-
                        {formatTime(row.overlap_end)}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/proposals/${row.proposal_id}`}
                          className="block hover:underline"
                        >
                          <span className="font-medium">{row.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.reference_number} · {row.organization_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/proposals/${row.conflicting_id}`}
                          className="block hover:underline"
                        >
                          <span className="font-medium">
                            {row.conflicting_title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {row.conflicting_reference} ·{' '}
                            {row.conflicting_organization_name}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venue list</CardTitle>
          <CardDescription>
            Inactive venues stay on past proposals but disappear from the form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VenueManager venues={(venues ?? []) as never} />
        </CardContent>
      </Card>
    </div>
  );
}
