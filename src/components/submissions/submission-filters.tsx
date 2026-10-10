import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STATUS_LABELS, SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/labels';

const FIELD_CLASS =
  'h-8 min-w-40 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

export interface FilterOrganization {
  id: string;
  name: string;
}

export function SubmissionFilters({
  action,
  values,
  statuses = SUBMISSION_STATUSES,
  organizations = null,
}: {
  action: string;
  values: { q?: string; status?: string; org?: string };
  statuses?: SubmissionStatus[];
  organizations?: FilterOrganization[] | null;
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        name="q"
        defaultValue={values.q ?? ''}
        placeholder="Search title or reference"
        aria-label="Search records"
        className="w-full sm:w-72"
      />

      <select
        name="status"
        defaultValue={values.status ?? ''}
        aria-label="Filter by status"
        className={FIELD_CLASS}
      >
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      {organizations ? (
        <select
          name="org"
          defaultValue={values.org ?? ''}
          aria-label="Filter by organization"
          className={FIELD_CLASS}
        >
          <option value="">All organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      ) : null}

      <Button type="submit" size="sm" variant="secondary">
        Apply
      </Button>
      <Link
        href={action}
        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        Clear
      </Link>
    </form>
  );
}
