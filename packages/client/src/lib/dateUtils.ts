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
