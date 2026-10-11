// Navigation + route authorization table.
// `roles: null` means every authenticated user may open the page; the actual
// row-level permissions still come from Postgres RLS.

import type { Database } from '@/lib/database.types';

export type UserRole = Database['public']['Enums']['user_role'];

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: string; // lucide icon name resolved in the sidebar component
  roles: UserRole[] | null;
  /** Only shown in the sidebar, never linked (used as a group title). */
  group: 'main' | 'osa' | 'admin';
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: null, group: 'main' },
  { href: '/proposals', label: 'Activity Proposals', icon: 'FileText', roles: null, group: 'main' },
  { href: '/reports', label: 'Accomplishment Reports', icon: 'ClipboardCheck', roles: null, group: 'main' },
  { href: '/audit-documents', label: 'Audit Documents', icon: 'BookOpenCheck', roles: null, group: 'main' },
  { href: '/documents', label: 'Other Documents', icon: 'FolderOpen', roles: null, group: 'main' },
  { href: '/calendar', label: 'Activity Calendar', icon: 'CalendarDays', roles: null, group: 'main' },
  { href: '/announcements', label: 'Announcements', icon: 'Megaphone', roles: null, group: 'main' },
  { href: '/requirements', label: 'Requirements', icon: 'ListChecks', roles: null, group: 'main' },
  { href: '/accreditation', label: 'Accreditation', icon: 'BadgeCheck', roles: null, group: 'main' },
  { href: '/turnover', label: 'Officer Turnover', icon: 'UserRoundCog', roles: null, group: 'main' },
  { href: '/templates', label: 'Form Templates', icon: 'FileSpreadsheet', roles: null, group: 'main' },
  { href: '/organizations', label: 'Organizations', icon: 'Users', roles: null, group: 'main' },
  { href: '/reviews', label: 'My Approvals', icon: 'CheckCheck', roles: ['adviser', 'dean'], group: 'main' },

  { href: '/osa/reviews', label: 'Review Queue', icon: 'Inbox', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/accreditation', label: 'Accreditation Review', icon: 'BadgeCheck', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/turnover', label: 'Turnover Review', icon: 'UserRoundCog', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/approval-chains', label: 'Approval Chains', icon: 'GitBranch', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/venues', label: 'Venues & Conflicts', icon: 'MapPin', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/templates', label: 'Template Library', icon: 'FileStack', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/hardcopy', label: 'Hardcopy Tracking', icon: 'Stamp', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/reports', label: 'Reports & Exports', icon: 'BarChart3', roles: ['osa_admin', 'super_admin'], group: 'osa' },
  { href: '/osa/audit-trail', label: 'Audit Trail', icon: 'ScrollText', roles: ['osa_admin', 'super_admin'], group: 'osa' },

  { href: '/admin/users', label: 'User Accounts', icon: 'UserCog', roles: ['super_admin'], group: 'admin' },
  { href: '/admin/school-years', label: 'School Years', icon: 'CalendarRange', roles: ['super_admin'], group: 'admin' },
];

/** Routes that may be opened without a session (see src/proxy.ts). */
export const PUBLIC_PATHS = ['/login', '/auth', '/api/cron'];

export function canAccess(item: NavItem, role: UserRole): boolean {
  return item.roles === null || item.roles.includes(role);
}

export function visibleNav(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(item, role));
}

/**
 * Prefix-based route guard used by pages that need a role. Enforced in the
 * Server Component / Server Action layer (authoritative - reads the role from
 * the database), never from a cookie the client could tamper with.
 */
export const ROLE_PREFIXES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: '/admin/users', roles: ['super_admin'] },
  { prefix: '/admin/school-years', roles: ['super_admin'] },
  { prefix: '/osa', roles: ['osa_admin', 'super_admin'] },
];

export function allowedRolesForPath(pathname: string): UserRole[] | null {
  const match = ROLE_PREFIXES.filter((r) => pathname.startsWith(r.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.roles : null;
}
