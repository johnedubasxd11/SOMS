import { NextResponse } from 'next/server';

import { emailPendingNotifications } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Fallback scheduler for requirement reminders.
 *
 * Preferred path: pg_cron runs `sweep_requirements(3)` daily at 06:00
 * (scheduled in the Phase 5 migration). Local Supabase ships without pg_cron,
 * so point any external scheduler here instead:
 *
 *   curl -X POST https://your-app/api/cron/reminders \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * The endpoint is in PUBLIC_PATHS so the session proxy lets it through; the
 * bearer secret is the only gate, and both RPCs are OSA/service-role only.
 */
async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured.' },
      { status: 503 }
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('sweep_requirements', {
    p_reminder_days: 3,
  });

  if (error) {
    console.error('[cron] sweep_requirements failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The sweep just created rows - mail the ones that are still pending.
  const emailed = await emailPendingNotifications({
    types: ['reminder'],
    since: new Date(Date.now() - 60 * 60 * 1000),
  });

  return NextResponse.json({
    ok: true,
    reminders: typeof data === 'number' ? data : 0,
    emailed,
    ran_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  return handle(request);
}

/** GET too - some schedulers only issue GETs. */
export async function GET(request: Request) {
  return handle(request);
}
