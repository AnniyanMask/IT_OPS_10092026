/**
 * Malaysian Timezone Utilities (Asia/Kuala_Lumpur, UTC+8)
 * Standardizes all system timestamps to synchronize with PostgreSQL database timezone.
 */

export const MALAYSIA_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Returns formatted Malaysian timestamp string in YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm
 */
export function getMalaysianTimestamp(
  date: Date | string | number = new Date(),
  includeSeconds: boolean = true
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return String(date || '');
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: MALAYSIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const YYYY = getPart('year');
    const MM = getPart('month');
    const DD = getPart('day');
    const hh = getPart('hour');
    const mm = getPart('minute');
    const ss = getPart('second');

    return includeSeconds ? `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}` : `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
  } catch {
    // Fallback if Intl timeZone fails
    const offsetMs = 8 * 60 * 60 * 1000;
    const mytDate = new Date(d.getTime() + offsetMs);
    const iso = mytDate.toISOString().replace('T', ' ');
    return includeSeconds ? iso.substring(0, 19) : iso.substring(0, 16);
  }
}

/**
 * Returns Malaysian Date formatted as YYYY-MM-DD
 */
export function getMalaysianDate(date: Date | string | number = new Date()): string {
  return getMalaysianTimestamp(date, false).split(' ')[0];
}

/**
 * Formats any date string or Date object to a clean, user-friendly display string
 * e.g. "01 Sep 2026, 12:39 PM" in Malaysian Time (Asia/Kuala_Lumpur, UTC+8)
 */
export function formatDisplayDateTime(
  date: Date | string | number | undefined | null,
  includeTime: boolean = true
): string {
  if (!date) return '-';
  const rawStr = String(date).trim();
  if (!rawStr || rawStr === '-') return '-';

  // Handle ISO string or space separated format
  let d: Date;
  if (typeof date === 'object' && date instanceof Date) {
    d = date;
  } else if (typeof date === 'number') {
    d = new Date(date);
  } else {
    // If it's a date only string like "2026-09-01", prevent timezone off-by-one by parsing year/month/day
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
      if (!includeTime) {
        const [y, m, day] = rawStr.split('-').map(Number);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(day).padStart(2, '0')} ${months[m - 1]} ${y}`;
      }
      d = new Date(`${rawStr}T00:00:00+08:00`);
    } else {
      d = new Date(rawStr);
    }
  }

  if (isNaN(d.getTime())) {
    return rawStr;
  }

  try {
    if (!includeTime) {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: MALAYSIA_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    }

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: MALAYSIA_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return getMalaysianTimestamp(d, false);
  }
}

/**
 * Formats date-only string to e.g. "01 Sep 2026"
 */
export function formatDisplayDate(date: Date | string | number | undefined | null): string {
  return formatDisplayDateTime(date, false);
}

/**
 * Formats any date string or Date object to Malaysian Time with human-friendly format
 */
export function formatToMalaysianDateTime(
  date: Date | string | number | undefined | null,
  includeSeconds: boolean = true
): string {
  if (!date) return '-';
  return getMalaysianTimestamp(date, includeSeconds);
}

