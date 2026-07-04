export type ViewMode = "month" | "week" | "day" | "agenda";

export const HOUR_HEIGHT = 56;
export const START_HOUR = 6;
export const END_HOUR = 24;
export const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: number | null;
  color: string;
  projectId?: number | null;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export type { Todo } from "@timebox/shared";

export interface HoverTooltipItem {
  type: "event" | "todo";
  title: string;
  time?: string;
  color: string;
  completed?: boolean;
  /** Todo category emoji — same as todo list */
  categoryIcon?: string;
}
