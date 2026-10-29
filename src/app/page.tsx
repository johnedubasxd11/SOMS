import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SchoolMark } from '@/components/layout/school-mark';
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <SchoolMark className="mx-auto size-14" />
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Assumption College of Davao
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Student Organization Management System
          </h1>
          <p className="text-sm text-muted-foreground">
            Onward, Onward Assumption
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Office of Student Affairs</CardTitle>
            <CardDescription>Sign in with your ACD e-mail address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
 
