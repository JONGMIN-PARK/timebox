// User preference for what the calendar's bottom panel shows by default.
// "month"    → remaining items from today through the end of the current month
// "upcoming" → all remaining items from today onward (bounded window)
export type CalendarBottomScope = "month" | "upcoming";

const KEY = "timebox_calendar_bottom_scope";
export const CALENDAR_PREFS_EVENT = "calendar-prefs-changed";

export function getCalendarBottomScope(): CalendarBottomScope {
  return localStorage.getItem(KEY) === "upcoming" ? "upcoming" : "month";
}

export function setCalendarBottomScope(scope: CalendarBottomScope): void {
  localStorage.setItem(KEY, scope);
  window.dispatchEvent(new Event(CALENDAR_PREFS_EVENT));
}
