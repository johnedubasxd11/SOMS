import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { moduleForRecordType, type RecordType } from '@/lib/submissions';

const RECORD_TYPES: RecordType[] = [
  'activity_proposal',
  'accomplishment_report',
  'audit_document',
  'other_document',
];

/**
 * QR cover-sheet image for one submission: the code encodes the public URL of
 * the record (`{origin}/{module}/{id}`), so a printed folder can be scanned
 * straight back to the digital copy.
 *
 * The session is validated and the record is read under the caller's own RLS,
 * so the route only ever codes records this account may already open.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ recordType: string; recordId: string }> }
) {
  const { recordType, recordId } = await ctx.params;
  await requireProfile();

  const mod = RECORD_TYPES.includes(recordType as RecordType)
    ? moduleForRecordType(recordType)
    : null;
  if (!mod) return new NextResponse('Unknown record type', { status: 404 });

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
    return new NextResponse('Invalid record id', { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from(mod.view)
    .select('id, reference_number')
    .eq('id', recordId)
    .maybeSingle();

  if (!data?.id) return new NextResponse('Not found', { status: 404 });

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${protocol}://${host}` : '';
  const url = `${origin}${mod.basePath}/${data.id}`;

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    margin: 1,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172aff', light: '#ffffffff' },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'private, max-age=3600',
    },
  });
}
