import { PageHeader } from '@/components/layout/page-header';
import { CreateSchoolYearForm } from '@/components/admin/create-school-year-form';
import { SetCurrentSchoolYearButton } from '@/components/admin/set-current-school-year-button';
import {
  ArchiveSchoolYearButton,
  RolloverSchoolYearButton,
} from '@/components/admin/school-year-archive-buttons';
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

  const hasCurrent = (schoolYears ?? []).some((year) => year.is_current);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="School years"
          description="Academic years used by proposals, reports and requirement tracking."
        />
        <RolloverSchoolYearButton hasCurrent={hasCurrent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All school years</CardTitle>
            <CardDescription>
              Submissions are always filed against one school year. Archived years
              become read-only for everyone.
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
                  <TableHead className="text-right">Archive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!schoolYears || schoolYears.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No school years yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  schoolYears.map((year) => (
                    <TableRow key={year.id} data-testid={`school-year-${year.name}`}>
                      <TableCell className="font-medium">
                        {year.name}
                        {year.is_archived ? (
                          <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground">
                            Archived
                          </Badge>
                        ) : null}
                      </TableCell>
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
                      <TableCell className="text-right">
                        <ArchiveSchoolYearButton
                          id={year.id}
                          name={year.name}
                          isCurrent={year.is_current}
                          isArchived={year.is_archived}
                        />
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
