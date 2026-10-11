'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ClipboardCheck,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderOpen,
  GitBranch,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  ScrollText,
  Search,
  Stamp,
  UserCog,
  UserRound,
  UserRoundCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { logoutAction } from '@/lib/actions/auth';
import { SchoolMark } from '@/components/layout/school-mark';
import { ROLE_LABELS, roleBadgeVariant, type UserRole } from '@/lib/labels';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from 'cn';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  BookOpen,
  BookOpenCheck,
  FolderOpen,
  ListChecks,
  Users,
  CheckCheck,
  GitBranch,
  Inbox,
  Stamp,
  BarChart3,
  UserCog,
  CalendarRange,
  CalendarDays,
  MapPin,
  ScrollText,
  Megaphone,
  FileSpreadsheet,
  FileStack,
  BadgeCheck,
  UserRoundCog,
};

export interface ShellNavItem {
  href: string;
  label: string;
  icon: string;
  group: 'main' | 'osa' | 'admin';
}

export interface ShellProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  position: string | null;
  organization_name: string | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function NavList({
  items,
  onNavigate,
}: {
  items: ShellNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups: { key: ShellNavItem['group']; title?: string }[] = [
    { key: 'main' },
    { key: 'osa', title: 'Office of Student Affairs' },
    { key: 'admin', title: 'Administration' },
  ];

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group.key);
        if (groupItems.length === 0) return null;

        return (
          <div key={group.key} className="space-y-1">
            {group.title ? (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {group.title}
              </p>
            ) : null}
            {groupItems.map((item) => {
              const Icon = ICONS[item.icon] ?? CircleIcon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return <span className={cn('block size-4 rounded-full border', className)} />;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
      <SchoolMark className="size-8 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">SOMS</p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          Office of Student Affairs
        </p>
      </div>
    </div>
  );
}

function UserMenu({ profile }: { profile: ShellProfile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 pl-1.5" data-testid="user-menu-trigger">
          <Avatar className="size-7">
            <AvatarFallback className="text-[11px]">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">
            {profile.full_name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{profile.full_name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {profile.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
          <Badge variant={roleBadgeVariant(profile.role)}>
            {ROLE_LABELS[profile.role]}
          </Badge>
          {profile.position ? (
            <span className="text-xs text-muted-foreground">
              {profile.position}
            </span>
          ) : null}
        </div>
        {profile.organization_name ? (
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">
            {profile.organization_name}
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserRound /> My Profile
          </Link>
        </DropdownMenuItem>
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  profile,
  nav,
  unreadNotifications,
  children,
}: {
  profile: ShellProfile;
  nav: ShellNavItem[];
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile sheet whenever the route changes (React's
  // "adjust state during render" pattern - no effect needed).
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <Brand />
        <NavList items={nav} />
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{profile.full_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <Brand />
                <NavList items={nav} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 lg:hidden">
            <SchoolMark className="size-6 shrink-0" />
            <p className="text-sm font-semibold">SOMS</p>
          </div>

          <form
            action="/search"
            method="get"
            className="ml-auto hidden items-center gap-2 md:flex"
          >
            <input
              type="search"
              name="q"
              placeholder="Search…"
              aria-label="Search SOMS"
              className="h-9 w-44 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring lg:w-56"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="shrink-0"
            >
              <Search />
            </Button>
          </form>
          <Link
            href="/search"
            className="ml-auto md:hidden"
            aria-label="Search"
          >
            <Button variant="ghost" size="icon">
              <Search />
            </Button>
          </Link>

          <div className="flex items-center gap-1">
            <NotificationBell
              userId={profile.id}
              initialUnread={unreadNotifications}
            />
            <UserMenu profile={profile} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
