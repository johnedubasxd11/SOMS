'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  addMonths,
  eventWindow,
  eventsByDay,
  monthGrid,
  monthKey,
  monthLabel,
  toIsoDate,
  type CalendarEvent,
  type CalendarFilterOption,
} from '@/lib/calendar';
import { STATUS_TONE, type SubmissionStatus } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from 'cn';

const SELECT_CLASS =
  'flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={`/proposals/${event.id}`}
      title={`${event.title} · ${event.organization_name} · ${eventWindow(event)}`}
      className={cn(
        'block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80',
        STATUS_TONE[event.status as SubmissionStatus] ?? 'bg-muted text-foreground'
      )}
    >
      {event.start_time ? event.start_time.slice(0, 5) : ''} {event.title}
    </Link>
  );
}

/**
 * Month board for `/calendar`. Filters only narrow what the view already
 * returned - they can never reveal an event the caller may not see.
 */
export function CalendarBoard({
  events,
  colleges,
  organizations,
  initialMonth,
}: {
  events: CalendarEvent[];
  colleges: CalendarFilterOption[];
  organizations: (CalendarFilterOption & { college_id: string | null })[];
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [collegeId, setCollegeId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (!collegeId || event.college_id === collegeId) &&
          (!organizationId || event.organization_id === organizationId) &&
          (!status || event.status === status)
      ),
    [events, collegeId, organizationId, status]
  );

  const visibleOrganizations = useMemo(
    () =>
      collegeId
        ? organizations.filter((org) => org.college_id === collegeId)
        : organizations,
    [organizations, collegeId]
  );

  const byDay = eventsByDay(filtered);
  const weeks = monthGrid(month);
  const today = toIsoDate(new Date());
  const monthEvents = filtered
    .filter((event) => event.activity_date.startsWith(month))
    .sort((a, b) =>
      `${a.activity_date}${a.start_time ?? ''}`.localeCompare(
        `${b.activity_date}${b.start_time ?? ''}`
      )
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-40 text-center text-sm font-semibold">
            {monthLabel(month)}
          </p>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMonth(monthKey(new Date()))}
          >
            Today
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className={SELECT_CLASS}
            value={collegeId}
            aria-label="Filter by college"
            onChange={(event) => {
              setCollegeId(event.target.value);
              setOrganizationId('');
            }}
          >
            <option value="">All colleges</option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>

          <select
            className={SELECT_CLASS}
            value={organizationId}
            aria-label="Filter by organization"
            onChange={(event) => setOrganizationId(event.target.value)}
          >
            <option value="">All organizations</option>
            {visibleOrganizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <select
            className={SELECT_CLASS}
            value={status}
            aria-label="Filter by status"
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="endorsed">Endorsed</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th
                  key={day}
                  className="border-b bg-muted/50 px-2 py-1.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={index}>
                {week.map((cell) => {
                  const inMonth = cell.iso.startsWith(month);
                  const dayEvents = byDay[cell.iso] ?? [];
                  return (
                    <td
                      key={cell.iso}
                      className={cn(
                        'h-24 w-[14%] border-t border-r p-1 align-top last:border-r-0',
                        !inMonth && 'bg-muted/30 text-muted-foreground',
                        cell.iso === today && 'bg-primary/5'
                      )}
                    >
                      <p className="mb-1 text-xs font-medium">{cell.date.getDate()}</p>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <EventChip key={event.id} event={event} />
                        ))}
                        {dayEvents.length > 3 ? (
                          <p className="text-[11px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </p>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border">
        <p className="border-b bg-muted/50 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Activities this month ({monthEvents.length})
        </p>
        {monthEvents.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No activities match the current filters.
          </p>
        ) : (
          <ul className="divide-y">
            {monthEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Badge variant="outline">{event.activity_date}</Badge>
                <Link
                  href={`/proposals/${event.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {event.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {event.organization_name}
                  {event.venue ? ` · ${event.venue}` : ''} · {eventWindow(event)}
                </span>
                <Badge className={cn('text-[10px]', STATUS_TONE[event.status])}>
                  {event.status.replace('_', ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
