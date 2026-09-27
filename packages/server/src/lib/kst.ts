/**
 * Korea Standard Time (KST / Asia/Seoul) helpers.
 *
 * All "today" calculations on the server must use these instead of
 * `new Date().toISOString().slice(0, 10)` which returns UTC date.
 */

const KST_TZ = 'Asia/Seoul';
import { dateInTimezone, calendarDaysBetween } from '@timebox/shared';

/** Current date in KST as "YYYY-MM-DD" */
export function kstToday(): string {
  return dateInTimezone(new Date(), KST_TZ);
}

/** Convert a real (UTC-based) Date to "YYYY-MM-DD" in KST */
export function toKstDateStr(d: Date): string {
  return dateInTimezone(d, KST_TZ);
}

/** Format a Date to "YYYY-MM-DD" using local getters (no timezone conversion) */
export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** KST today + N days as "YYYY-MM-DD" */
export function kstDateOffset(days: number): string {
  const d = new Date(kstToday() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days remaining from KST today to a target "YYYY-MM-DD" */
export function calcDaysLeft(targetDate: string): number {
  return calendarDaysBetween(kstToday(), targetDate);
}

export const KST_TIMEZONE = KST_TZ;
