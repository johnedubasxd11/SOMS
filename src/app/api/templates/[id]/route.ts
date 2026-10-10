import { NextResponse, type NextRequest } from 'next/server';

import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Streams a template through a short-lived signed URL (Phase 7). The bucket
 * is private; the `templates` row is read with the caller's own RLS rules
 * (every signed-in user may read templates), then Supabase hands out a
 * 10-minute URL. Version history stays downloadable: inactive rows are still
 * readable - only the board hides them from non-OSA.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await requireProfile();

  const supabase = await createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (!template) {
    return new NextResponse('File not found', { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from('templates')
    .createSignedUrl(template.storage_path, 600);

  if (error || !data?.signedUrl) {
    return new NextResponse('Could not open the file', { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
