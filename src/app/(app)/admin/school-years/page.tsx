import { PageHeader } from '@/components/layout/page-header';
import { CreateSchoolYearForm } from '@/components/admin/create-school-year-form';
import { SetCurrentSchoolYearButton } from '@/components/admin/set-current-school-year-button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function SchoolYearsPage() {
  await requireRole('super_admin');

  const supabase = await createClient();
  const { data: schoolYears } = await supabase
    .from('school_years')
    .select('*')
    .order('start_date', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="School years"
        description="Academic years used by proposals, reports and requirement tracking."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All school years</CardTitle>
            <CardDescription>
              Submissions are always filed against one school year.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School year</TableHead>
                  <TableHead>Runs from</TableHead>
                  <TableHead>Until</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!schoolYears || schoolYears.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No school years yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  schoolYears.map((year) => (
                    <TableRow key={year.id}>
                      <TableCell className="font-medium">{year.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(year.start_date).toLocaleDateString('en-PH')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(year.end_date).toLocaleDateString('en-PH')}
                      </TableCell>
                      <TableCell className="text-right">
                        {year.is_current ? (
                          <Badge>Current</Badge>
                        ) : (
                          <SetCurrentSchoolYearButton id={year.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a school year</CardTitle>
            <CardDescription>e.g. 2027-2028.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateSchoolYearForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
