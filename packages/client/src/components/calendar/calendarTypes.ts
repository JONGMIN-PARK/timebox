export type ViewMode = "month" | "week" | "day";

export const HOUR_HEIGHT = 56;
export const START_HOUR = 6;
export const END_HOUR = 24;
export const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
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
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: string;
  category: string;
  dueDate: string | null;
  sortOrder: number;
  parentId: number | null;
  projectId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface HoverTooltipItem {
  type: "event" | "todo";
  title: string;
  time?: string;
  color: string;
  completed?: boolean;
}
