const TZ = "Asia/Seoul";
const LOCALE = "ko-KR";

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(LOCALE, {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(LOCALE, {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(LOCALE, {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function formatShortDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(LOCALE, {
    timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const koNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const koDate = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  if (koDate.toDateString() === koNow.toDateString()) {
    return formatTime(dateStr);
  }
  return dateStr.slice(0, 10);
}

export function koNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDDay(days: number): string {
  if (days === 0) return "D-Day!";
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

/** Format ISO string to "YYYY-MM-DD HH:mm" in KST */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const kst = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const dd = String(kst.getDate()).padStart(2, "0");
  const h = String(kst.getHours()).padStart(2, "0");
  const min = String(kst.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${h}:${min}`;
}
