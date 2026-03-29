// ── Configurable timezone ──
const STORAGE_KEY = "timebox_timezone";

let _timezone: string | null = null;

export function getTimezone(): string {
  if (_timezone) return _timezone;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      _timezone = stored;
      return _timezone;
    }
  } catch {
    // localStorage unavailable (SSR, etc.)
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function setTimezone(tz: string): void {
  _timezone = tz;
  try {
    localStorage.setItem(STORAGE_KEY, tz);
  } catch {
    // localStorage unavailable
  }
}

const LOCALE = "ko-KR";

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(LOCALE, {
    timeZone: getTimezone(), year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(LOCALE, {
    timeZone: getTimezone(), year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(LOCALE, {
    timeZone: getTimezone(), hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function formatShortDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(LOCALE, {
    timeZone: getTimezone(), month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const tz = getTimezone();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const tzDate = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  if (tzDate.toDateString() === tzNow.toDateString()) {
    return formatTime(dateStr);
  }
  return dateStr.slice(0, 10);
}

/** Get current time in the configured timezone */
export function localNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: getTimezone() }));
}

/** @deprecated Use localNow() instead */
export const koNow = localNow;

export function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDDay(days: number): string {
  if (days === 0) return "D-Day!";
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

/** Format ISO string to "YYYY-MM-DD HH:mm" in the configured timezone */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const tz = getTimezone();
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  const h = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${h}:${min}`;
}
