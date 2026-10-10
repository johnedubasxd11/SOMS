import Link from 'next/link';

import { markAllNotificationsReadAction } from '@/lib/actions/notifications';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCheck, Inbox } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { formatDateTime, formatDistanceToNow } from '@/lib/format';
import { NOTIFICATION_LABELS } from '@/lib/labels';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/server';

const TYPE_TONE: Record<string, string> = {
  status_change: 'bg-blue-500/15 text-blue-700',
  comment: 'bg-amber-500/15 text-amber-700',
  requirement: 'bg-violet-500/15 text-violet-700',
  reminder: 'bg-orange-500/15 text-orange-700',
  system: 'bg-muted text-muted-foreground',
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const profile = await requireProfile();
  const { filter } = await searchParams;
  const unreadOnly = filter === 'unread';

  const supabase = await createClient();
  let builder = supabase
    .from('notifications')
    .select('id, title, body, link, type, is_read, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (unreadOnly) builder = builder.eq('is_read', false);

  const { data: notifications } = await builder;
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Notifications"
          description="Status changes, reviewer comments, reminders and system notices."
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Link
              href="/notifications"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                !unreadOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </Link>
            <Link
              href="/notifications?filter=unread"
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                unreadOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Unread
              {unreadCount ? <span className="ml-1.5">{unreadCount}</span> : null}
            </Link>
          </div>
          <form action={markAllNotificationsReadAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!unreadCount}
            >
              <CheckCheck /> Mark all read
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!notifications || notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1.5 text-center">
              <Inbox className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {unreadOnly ? 'No unread notifications.' : 'Nothing here yet.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {unreadOnly
                  ? `You're all caught up, ${profile.full_name.split(' ')[0]}.`
                  : 'Status changes and reminders land here.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link ?? '#'}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60',
                      !item.is_read && 'bg-muted/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-2 size-2 shrink-0 rounded-full',
                        item.is_read ? 'invisible' : 'bg-primary'
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-transparent text-[11px]',
                            TYPE_TONE[item.type]
                          )}
                        >
                          {NOTIFICATION_LABELS[item.type] ?? item.type}
                        </Badge>
                      </div>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)} -{' '}
                        {formatDistanceToNow(item.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
