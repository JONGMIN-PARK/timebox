import { format, parseISO } from "date-fns";

/** True if the event spans more than one calendar day. */
export function isMultiDay(startTime: string, endTime?: string | null): boolean {
  const s = startTime.slice(0, 10);
  const e = (endTime || startTime).slice(0, 10);
  return e !== s;
}

/** True if the event should render in an all-day lane rather than on a time grid. */
export function isAllDayLike(ev: { startTime: string; endTime?: string | null; allDay?: boolean }): boolean {
  return !!ev.allDay || isMultiDay(ev.startTime, ev.endTime);
}

/**
 * Human-friendly time label:
 * - multi-day  → "M/D–M/D" (the span, which is the useful info)
 * - all-day    → `allDayLabel` (caller passes the localized "All day")
 * - otherwise  → "HH:MM–HH:MM"
 */
export function eventTimeLabel(
  ev: { startTime: string; endTime?: string | null; allDay?: boolean },
  allDayLabel: string,
): string {
  const s = ev.startTime.slice(0, 10);
  const e = (ev.endTime || ev.startTime).slice(0, 10);
  if (e !== s) {
    return `${format(parseISO(s), "M/d")}–${format(parseISO(e), "M/d")}`;
  }
  if (ev.allDay) return allDayLabel;
  return `${ev.startTime.slice(11, 16)}–${(ev.endTime || ev.startTime).slice(11, 16)}`;
}
