import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { requireProfile } from '@/lib/auth';
import { visibleNav } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'SOMS | Office of Student Affairs',
};

/**
 * Authenticated application shell. requireProfile() is authoritative: it
 * reads the session + profile row from the database on every request, so a
 * forged cookie can never reach these pages.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  if (!profile.is_active) redirect('/login?error=inactive');

  const nav = visibleNav(profile.role).map(({ href, label, icon, group }) => ({
    href,
    label,
    icon,
    group,
  }));

  const supabaseBase = await createClient();

  let organizationName: string | null = null;
  if (profile.organization_id) {
    const { data } = await supabaseBase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .maybeSingle();
    organizationName = data?.name ?? null;
  }

  // Unread badge for the header bell (RLS scopes this to the caller's rows).
  const { count: unreadNotifications } = await supabaseBase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <AppShell
      nav={nav}
      unreadNotifications={unreadNotifications ?? 0}
      profile={{
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        position: profile.position,
        organization_name: organizationName,
      }}
    >
      {children}
    </AppShell>
  );
}
