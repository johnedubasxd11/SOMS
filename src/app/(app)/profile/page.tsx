import { PageHeader } from '@/components/layout/page-header';
import { ChangePasswordForm } from '@/components/profile/change-password-form';
import { ProfileDetailsForm } from '@/components/profile/profile-details-form';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireProfile } from '@/lib/auth';
import { ROLE_LABELS, roleBadgeVariant } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const profile = await requireProfile();

  const supabase = await createClient();

  const organization = profile.organization_id
    ? (
        await supabase
          .from('organizations')
          .select('code, name')
          .eq('id', profile.organization_id)
          .single()
      ).data
    : null;

  const college = profile.college_id
    ? (
        await supabase
          .from('colleges')
          .select('code, name')
          .eq('id', profile.college_id)
          .single()
      ).data
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your account details and password. Role and organization are managed by OSA / IT."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Read-only - contact OSA to change these.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <DetailRow label="E-mail" value={profile.email} />
            <DetailRow
              label="Role"
              value={
                <Badge variant={roleBadgeVariant(profile.role)}>
                  {ROLE_LABELS[profile.role]}
                </Badge>
              }
            />
            <DetailRow
              label="Organization"
              value={
                organization
                  ? `${organization.code} — ${organization.name}`
                  : '—'
              }
            />
            <DetailRow
              label="College"
              value={college ? `${college.code} — ${college.name}` : '—'}
            />
            <DetailRow
              label="Last sign-in"
              value={
                profile.last_sign_in_at
                  ? new Date(profile.last_sign_in_at).toLocaleString('en-PH')
                  : '—'
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My details</CardTitle>
              <CardDescription>Display name and position.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileDetailsForm
                profile={{
                  full_name: profile.full_name,
                  position: profile.position,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Replace the temporary password you were given.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
