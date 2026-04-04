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

/** Current Date object shifted to KST (for date arithmetic like D-Day) */
export function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: KST_TZ }));
}

/** Convert any Date to "YYYY-MM-DD" in KST */
export function toKstDateStr(d: Date): string {
  return dateFormatter.format(d);
}

export const KST_TIMEZONE = KST_TZ;
