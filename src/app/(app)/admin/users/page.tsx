import { PageHeader } from '@/components/layout/page-header';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import {
  UserActions,
  type CollegeOption,
  type OrgOption,
  type UserRow,
} from '@/components/admin/user-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth';
import { ROLE_LABELS, roleBadgeVariant } from '@/lib/labels';
import { USER_ROLES } from '@/lib/validations/users';
import { createClient } from '@/lib/supabase/server';
import { cn } from 'cn';

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9.@ -]/g, '').slice(0, 60);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const me = await requireRole('super_admin');
  const { q = '', role = '' } = await searchParams;

  const supabase = await createClient();

  let builder = supabase
    .from('profiles')
    .select(
      'id, full_name, email, role, position, is_active, last_sign_in_at, organization_id, college_id, organizations(name, code), colleges(name, code)'
    )
    .order('full_name');

  const query = sanitize(q);
  if (query) builder = builder.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  if ((USER_ROLES as readonly string[]).includes(role)) {
    builder = builder.eq('role', role as UserRow['role']);
  }

  const [{ data: users }, { data: organizations }, { data: colleges }] = await Promise.all([
    builder,
    supabase.from('organizations').select('id, code, name').order('name'),
    supabase.from('colleges').select('id, code, name').order('name'),
  ]);

  const orgOptions = (organizations ?? []) as OrgOption[];
  const collegeOptions = (colleges ?? []) as CollegeOption[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User accounts"
        description="Create accounts, assign roles and organizations, deactivate access."
      >
        <CreateUserDialog organizations={orgOptions} colleges={collegeOptions} />
      </PageHeader>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or e-mail"
          aria-label="Search users"
          className="max-w-xs"
        />
        <select
          name="role"
          defaultValue={role}
          aria-label="Filter by role"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none md:text-sm dark:bg-input/30"
        >
          <option value="">All roles</option>
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!users || users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No user matches your search.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className={cn(!user.is_active && 'opacity-60')}>
                    <TableCell>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.colleges ? (
                        <>{user.colleges.name}</>
                      ) : user.organizations ? (
                        <>
                          {user.organizations.name}{' '}
                          <span className="text-xs">({user.organizations.code})</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.position ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'secondary' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString('en-PH')
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions
                        user={user as unknown as UserRow}
                        organizations={orgOptions}
                        colleges={collegeOptions}
                        isSelf={user.id === me.id}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
