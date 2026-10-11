import { NextResponse, type NextRequest } from 'next/server';

import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Streams one organization's accreditation upload through a short-lived
 * signed URL (Phase 6). The `org-documents` bucket is private; the
 * `accreditation_submissions` row is read with the caller's own RLS rules
 * (own organization, its adviser/dean, or OSA), then Supabase hands out a
 * 10-minute URL.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await requireProfile();

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from('accreditation_submissions')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!submission) {
    return new NextResponse('File not found', { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from('org-documents')
    .createSignedUrl(submission.storage_path, 600);

  if (error || !data?.signedUrl) {
    return new NextResponse('Could not open the file', { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
