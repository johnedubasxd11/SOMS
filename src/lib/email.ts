import 'server-only';

import type { Database } from '@/lib/database.types';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * E-mail dispatch (Resend HTTP API).
 *
 * Design notes:
 *   - The database already decides WHO gets notified (notify_user(),
 *     notify_org_officers(), sweep_requirements() write `notifications` rows).
 *     This module only mirrors those rows to e-mail - it never re-implements
 *     the recipient rules, so in-app and e-mail can never disagree.
 *   - `notifications.emailed_at` is the dispatch marker: a row is e-mailed at
 *     most once, and failures simply leave it NULL for the next run.
 *   - Without RESEND_API_KEY the send is a logged no-op, so local development
 *     works without a Resend account.
 */

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_WINDOW_MINUTES = 15;
const MAX_PER_DISPATCH = 50;

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends one message. Returns false when skipped or failed (never throws). */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email] skipped (no RESEND_API_KEY): ${payload.subject}`);
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'SOMS <no-reply@assumption.edu.ph>',
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[email] Resend ${response.status}: ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email] send failed:', error);
    return false;
  }
}

/** Minimal branded template - plain enough to survive aggressive mail clients. */
function renderHtml(title: string, body: string, link: string | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const action = link
    ? `<p style="margin:24px 0"><a href="${appUrl}${link}"
        style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;
               text-decoration:none;font-weight:600">Open in SOMS</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;
    color:#111827;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
    <div style="font-size:13px;color:#6b7280;letter-spacing:.08em;text-transform:uppercase">
      Assumption College of Davao — Office of Student Affairs
    </div>
    <h2 style="margin:12px 0 4px">${title}</h2>
    <p style="white-space:pre-wrap;margin:8px 0">${body ?? ''}</p>
    ${action}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="font-size:12px;color:#6b7280">
      You received this because your SOMS account is part of the thread above.
      Reply in the application - this mailbox is not monitored.
    </p>
  </body></html>`;
}

export interface DispatchFilter {
  /** Notifications of exactly these ids (e.g. returned by an RPC). */
  ids?: string[];
  /** Or: every not-yet-emailed notification for one submission. */
  recordType?: NotificationRow['record_type'];
  recordId?: string;
  /** Or: every not-yet-emailed notification newer than this date. */
  since?: Date;
  types?: NotificationRow['type'][];
}

/**
 * Mirrors pending `notifications` rows to e-mail and stamps `emailed_at`.
 * Returns the number of messages accepted by the provider.
 */
export async function emailPendingNotifications(
  filter: DispatchFilter = {}
): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return 0; // nothing to do - in-app notifications still work

  const since =
    filter.since ??
    new Date(Date.now() - DEFAULT_WINDOW_MINUTES * 60 * 1000);

  const admin = createAdminClient();
  let query = admin
    .from('notifications')
    .select(
      `id, title, body, link, type,
       recipient:profiles!notifications_user_id_fkey(id, full_name, email, is_active)`
    )
    .is('emailed_at', null)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_DISPATCH);

  if (filter.ids && filter.ids.length > 0) {
    query = query.in('id', filter.ids);
  } else {
    query = query.gte('created_at', since.toISOString());
    if (filter.recordType) query = query.eq('record_type', filter.recordType);
    if (filter.recordId) query = query.eq('record_id', filter.recordId);
    if (filter.types && filter.types.length > 0) query = query.in('type', filter.types);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[email] could not load pending notifications:', error.message);
    return 0;
  }

  let sent = 0;
  for (const row of data ?? []) {
    const recipient = row.recipient as Pick<ProfileRow, 'full_name' | 'email' | 'is_active'> | null;
    if (!recipient?.email || !recipient.is_active) {
      // No usable address - mark it handled so it is never retried.
      await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', row.id);
      continue;
    }

    const ok = await sendEmail({
      to: recipient.email,
      subject: `SOMS: ${row.title}`,
      html: renderHtml(row.title, row.body ?? '', row.link),
      text: `${row.title}\n\n${row.body ?? ''}\n\n${
        row.link
          ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${row.link}`
          : ''
      }`,
    });

    if (ok) {
      sent += 1;
      await admin
        .from('notifications')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  return sent;
}
