import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { SchoolMark } from '@/components/layout/school-mark';
import { getCurrentUser } from '@/lib/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { next, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <SchoolMark className="mx-auto size-14" />
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Assumption College of Davao
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">SOMS</h1>
          <p className="text-sm text-muted-foreground">
            Student Organization Management System
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Office of Student Affairs</CardTitle>
            <CardDescription>Sign in with your ACD e-mail address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error === 'inactive' ? (
              <Alert variant="destructive">
                <AlertTitle>Account deactivated</AlertTitle>
                <AlertDescription>
                  Your account has been deactivated. Please contact the Office of
                  Student Affairs.
                </AlertDescription>
              </Alert>
            ) : null}

            <LoginForm next={next} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
