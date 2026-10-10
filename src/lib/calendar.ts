import { formatTime } from '@/lib/format';
import type { SubmissionStatus } from '@/lib/labels';

/**
 * Calendar projection helpers shared by the `/calendar` page (server) and the
 * board (client). One event row comes from `v_calendar_events`, whose rules
 * (OSA / own org / adviser / dean / approved-for-everyone) are embedded in
 * the view - the screen never widens them.
 */
export interface CalendarEvent {
  id: string;
  reference_number: string;
  title: string;
  activity_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  venue_id: string | null;
  status: SubmissionStatus;
  organization_id: string;
  organization_name: string;
  college_id: string | null;
  college_name: string | null;
}

export interface CalendarFilterOption {
  id: string;
  name: string;
}

/** "2026-10" - the month key the board navigates by. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

export function addMonths(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + delta, 1));
}

/** Weeks (each 7 days) covering the month, padded to whole weeks. */
export function monthGrid(key: string): { date: Date; iso: string }[][] {
  const [year, month] = key.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  // Monday-first grid (en-PH weeks start on Sunday in `getDay`, shift here).
  const offset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - offset);

  const weeks: { date: Date; iso: string }[][] = [];
  const cursor = new Date(start);

  for (let week = 0; week < 6; week += 1) {
    const row: { date: Date; iso: string }[] = [];
    for (let day = 0; day < 7; day += 1) {
      row.push({ date: new Date(cursor), iso: toIsoDate(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
    if (cursor.getMonth() !== first.getMonth() && week >= 3) break;
  }

  return weeks;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function eventsByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    (acc[event.activity_date] ??= []).push(event);
    return acc;
  }, {});
}

/** "2:30 PM-5:00 PM" or "Whole day" when no times were recorded. */
export function eventWindow(event: CalendarEvent): string {
  if (!event.start_time && !event.end_time) return 'Whole day';
  return `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
}
