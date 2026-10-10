'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/actions/notifications';
import type { ActionResult } from '@/lib/action-result';
import { formatDistanceToNow } from '@/lib/format';
import { NOTIFICATION_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from 'cn';

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: keyof typeof NOTIFICATION_LABELS;
  is_read: boolean;
  created_at: string;
}

const MAX_INLINE = 8;

const INITIAL: ActionResult = { ok: true };

/**
 * Header bell: unread badge + the latest notifications, kept live by a
 * Supabase Realtime subscription. Realtime applies the same SELECT policy as
 * the REST client, so the channel only ever delivers rows the signed-in user
 * owns (notifications_select: user_id = auth.uid()).
 *
 * Marking as read posts a server action - RLS re-checks ownership there too.
 */
export function NotificationBell({
  userId,
  initialUnread,
}: {
  userId: string;
  initialUnread: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const loaded = useRef(false);

  // Latest rows for the realtime callback (avoids re-subscribing on updates).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Initial load of the latest notifications (only once).
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    supabase
      .from('notifications')
      .select('id, title, body, link, type, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_INLINE)
      .then(({ data }) => {
        if (data) setItems(data as NotificationItem[]);
      });
  }, [supabase]);

  // Realtime: INSERTs and UPDATEs of this user's notifications.
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationItem;
            setItems((current) => [row, ...current].slice(0, MAX_INLINE));
            if (!row.is_read) setUnread((count) => count + 1);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as NotificationItem;
            const wasRead = itemsRef.current.find(
              (item) => item.id === row.id
            )?.is_read;
            setItems((current) =>
              current.map((item) => (item.id === row.id ? row : item))
            );
            if (wasRead === false && row.is_read) {
              setUnread((count) => Math.max(0, count - 1));
            }
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as { id: string };
            setItems((current) => current.filter((item) => item.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  function markRead(item: NotificationItem) {
    if (item.is_read) return;
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_read: true } : row))
    );
    setUnread((count) => Math.max(0, count - 1));
    const formData = new FormData();
    formData.set('id', item.id);
    startTransition(() => {
      void markNotificationReadAction(INITIAL, formData);
    });
  }

  function markAll() {
    setItems((current) =>
      current.map((row) => ({ ...row, is_read: true }))
    );
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'
          }
        >
          <Bell />
          {unread > 0 ? (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full',
                'bg-destructive px-1 text-[10px] leading-4 font-semibold text-destructive-foreground'
              )}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={markAll}
            >
              <CheckCheck /> Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <Inbox className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
            <p className="text-xs text-muted-foreground">
              Status changes and reminders show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.link ?? '/notifications'}
                  onClick={() => {
                    markRead(item);
                    setOpen(false);
                  }}
                  className={cn(
                    'block px-3 py-2.5 transition-colors hover:bg-muted/60',
                    !item.is_read && 'bg-muted/40'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!item.is_read ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    ) : (
                      <span className="mt-1.5 size-2 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      {item.body ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {NOTIFICATION_LABELS[item.type]} -{' '}
                        {formatDistanceToNow(item.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator />
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block px-3 py-2 text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
