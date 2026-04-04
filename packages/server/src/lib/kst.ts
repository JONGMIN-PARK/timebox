/**
 * Korea Standard Time (KST / Asia/Seoul) helpers.
 *
 * All "today" calculations on the server must use these instead of
 * `new Date().toISOString().slice(0, 10)` which returns UTC date.
 */

const KST_TZ = "Asia/Seoul";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current date in KST as "YYYY-MM-DD" */
export function kstToday(): string {
  return dateFormatter.format(new Date());
}

/** Convert a real (UTC-based) Date to "YYYY-MM-DD" in KST */
export function toKstDateStr(d: Date): string {
  return dateFormatter.format(d);
}

/** Format a Date to "YYYY-MM-DD" using local getters (no timezone conversion) */
export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** KST today + N days as "YYYY-MM-DD" */
export function kstDateOffset(days: number): string {
  const d = new Date(kstToday() + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatDateLocal(d);
}

/** Days remaining from KST today to a target "YYYY-MM-DD" */
export function calcDaysLeft(targetDate: string): number {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date(kstToday() + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const KST_TIMEZONE = KST_TZ;
