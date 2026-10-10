'use client';

import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';

import { findVenueConflicts, type VenueConflict } from '@/lib/actions/venues';
import { formatTime } from '@/lib/format';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Live "this slot is already booked" warning on the proposal form. It asks
 * the database (`find_venue_conflicts()`) as the officer types - the exact
 * function the submit guard trigger uses, so the form can never disagree
 * with what the server will allow on submit.
 */
export function VenueConflictWarning({
  venueId,
  activityDate,
  startTime,
  endTime,
  recordId,
}: {
  venueId: string | null;
  activityDate: string;
  startTime?: string | null;
  endTime?: string | null;
  recordId?: string | null;
}) {
  const [result, setResult] = useState<{ key: string; conflicts: VenueConflict[] }>({
    key: '',
    conflicts: [],
  });
  const request = useRef(0);

  const key = [venueId, activityDate, startTime, endTime, recordId].join('|');

  useEffect(() => {
    if (!venueId || !activityDate) return;

    const current = ++request.current;
    const timer = setTimeout(() => {
      findVenueConflicts({
        venueId,
        activityDate,
        startTime,
        endTime,
        excludeId: recordId,
      })
        .then((rows) => {
          if (request.current === current) setResult({ key, conflicts: rows });
        })
        .catch(() => {
          if (request.current === current) setResult({ key, conflicts: [] });
        });
    }, 350);

    return () => clearTimeout(timer);
    // `key` captures every input the query depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!venueId || !activityDate) return null;

  // Stale results from a previous slot are hidden until the current one lands.
  const conflicts = result.key === key ? result.conflicts : [];
  const checking = result.key !== key;
  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>
        {conflicts.length === 1
          ? 'Venue already booked'
          : `${conflicts.length} venue conflicts`}
        {checking ? ' (checking…)' : ''}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {conflicts.map((conflict) => (
            <li key={conflict.recordId}>
              {conflict.title} ({conflict.referenceNumber}) -{' '}
              {conflict.organizationName} holds{' '}
              {conflict.startTime || conflict.endTime
                ? `${formatTime(conflict.startTime)}-${formatTime(conflict.endTime)}`
                : 'the whole day'}{' '}
              on this date.
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Submitting will be refused while this overlap exists - pick another
          venue, date or time slot.
        </p>
      </AlertDescription>
    </Alert>
  );
}
