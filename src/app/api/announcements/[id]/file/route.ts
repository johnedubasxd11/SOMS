import { NextResponse, type NextRequest } from 'next/server';

import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Streams an announcement attachment through a short-lived signed URL
 * (Phase 7). The `announcements` row is read with the caller's own RLS rules
 * (OSA sees everything; everyone else only sees live announcements that
 * target them), so an expired or mistargeted attachment cannot be fetched.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await requireProfile();

  const supabase = await createClient();
  const { data: announcement } = await supabase
    .from('announcements')
    .select('attachment_path')
    .eq('id', id)
    .maybeSingle();

  if (!announcement?.attachment_path) {
    return new NextResponse('File not found', { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from('announcements')
    .createSignedUrl(announcement.attachment_path, 600);

  if (error || !data?.signedUrl) {
    return new NextResponse('Could not open the file', { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
