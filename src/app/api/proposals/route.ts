import { type NextRequest, NextResponse } from 'next/server';

import { getProfile } from '@/lib/auth';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/proposals?q=&status=&org=&page=
 *
 * JSON list of activity proposals, scoped by RLS through the caller's own
 * session (the same view the /proposals page renders). Filter parameters
 * mirror the page: `q` searches title / reference number, `status` is a
 * lifecycle value, `org` is OSA-only. 12 rows per page.
 */

const PAGE_SIZE = 12;

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 60);
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const q = sanitize(searchParams.get('q') ?? '');
  const status = searchParams.get('status') ?? '';
  const org = searchParams.get('org') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const isOsa = profile.role === 'osa_admin' || profile.role === 'super_admin';
  const statusFilter = (SUBMISSION_STATUSES as string[]).includes(status)
    ? (status as SubmissionStatus)
    : '';

  const supabase = await createClient();
  let builder = supabase
    .from('v_activity_proposal_list')
    .select('*', { count: 'exact' });

  if (q) {
    builder = builder.or(`title.ilike.%${q}%,reference_number.ilike.%${q}%`);
  }
  if (statusFilter) builder = builder.eq('status', statusFilter);
  if (isOsa && org) builder = builder.eq('organization_id', org);

  const { data, count, error } = await builder
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    reference_number: row.reference_number,
    title: row.title,
    status: row.status ?? 'draft',
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    created_at: row.created_at,
    activity_date: 'activity_date' in row ? row.activity_date : null,
    attachment_count: row.attachment_count,
  }));

  return NextResponse.json({
    data: rows,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  });
}
