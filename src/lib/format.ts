/** Small presentation helpers shared by the Phase 3 screens. */

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Date-only columns arrive as YYYY-MM-DD - format them directly so the
  // browser's timezone can never shift the day backwards.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 14:30 -> 2:30 PM (Postgres `time` columns arrive as HH:MM:SS). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [hours, minutes] = value.split(':');
  const h = Number(hours);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${minutes ?? '00'} ${suffix}`;
}

export function formatMoney(value: number | null | undefined): string {
  const amount = value ?? 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatBytes(bytes: number | null | undefined): string {
  const size = bytes ?? 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 minutes ago" / "in 2 days" - used by the notification list. */
export function formatDistanceToNow(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];
  let duration = seconds;
  for (const [unit, size] of units) {
    if (Math.abs(duration) < size) return rtf.format(Math.round(duration), unit);
    duration /= size;
  }
  return rtf.format(Math.round(duration), 'year');
}
