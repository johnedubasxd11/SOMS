import { NextResponse, type NextRequest } from 'next/server';

import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Streams an attachment through a short-lived signed URL.
 *
 * The buckets are private, so the file can only be reached here: the session
 * is validated, the `documents` row is read with the caller's own RLS rules,
 * and only then does Supabase hand out a 10-minute URL.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await requireProfile();

  const supabase = await createClient();
  const { data: document } = await supabase
    .from('documents')
    .select('bucket, storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!document) {
    return new NextResponse('File not found', { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(document.bucket)
    .createSignedUrl(document.storage_path, 600);

  if (error || !data?.signedUrl) {
    return new NextResponse('Could not open the file', { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
