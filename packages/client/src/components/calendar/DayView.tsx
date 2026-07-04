import React, { memo } from "react";
import { format, isToday } from "date-fns";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryInfo } from "@/lib/categories";
import { useI18n } from "@/lib/useI18n";
import { isAllDayLike, eventTimeLabel } from "@/lib/eventFormat";
import {
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  HOURS,
  timeToMinutes,
} from "./calendarTypes";
import type { CalendarEvent, Todo } from "./calendarTypes";

// Column-packing layout: place overlapping events side-by-side.
// Returns a map id -> { col, cols } where cols is the width of the event's
// overlap cluster (max simultaneous overlaps) and col is its slot within it.
function packColumns(events: CalendarEvent[]): Map<number, { col: number; cols: number }> {
  const result = new Map<number, { col: number; cols: number }>();
  const items = events
    .map((ev) => ({
      ev,
      s: timeToMinutes(ev.startTime.slice(11, 16)),
      e: Math.max(timeToMinutes(ev.endTime.slice(11, 16)), timeToMinutes(ev.startTime.slice(11, 16)) + 1),
    }))
    .sort((a, b) => a.s - b.s || a.e - b.e);

  let cluster: Array<{ ev: CalendarEvent; col: number }> = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    for (const p of cluster) result.set(p.ev.id, { col: p.col, cols });
    cluster = [];
    colEnds = [];
  };

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.s);
    if (col === -1) col = colEnds.length;
    colEnds[col] = it.e;
    cluster.push({ ev: it.ev, col });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return result;
}

// Memoized calendar event item for day timeline view
const DayEventItem = memo(function DayEventItem({
  ev, onDelete, onClick, col, cols,
}: {
  ev: CalendarEvent;
  onDelete: (id: number) => void;
  onClick?: (ev: CalendarEvent) => void;
  col: number;
  cols: number;
}) {
  const startMin = timeToMinutes(ev.startTime.slice(11, 16));
  const endMin = timeToMinutes(ev.endTime.slice(11, 16));
  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);
  // Grid gutter is 3.5rem (left-14); right padding is 0.75rem (right-3).
  const GUTTER = "3.5rem";
  const PAD = "0.75rem";
  const track = `(100% - ${GUTTER} - ${PAD})`;
  const left = `calc(${GUTTER} + ${col} * ${track} / ${cols})`;
  const width = `calc(${track} / ${cols} - 2px)`;
  return (
    <div
      className="absolute rounded-lg border-l-4 px-3 py-1.5 group cursor-pointer"
      style={{ top, height, left, width, borderLeftColor: ev.color || "#3b82f6", backgroundColor: (ev.color || "#3b82f6") + "18" }}
      onClick={() => onClick?.(ev)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
          {height >= 40 && <p className="text-xs text-slate-400">{ev.startTime.slice(11, 16)} - {ev.endTime.slice(11, 16)}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }} className="hidden group-hover:flex w-5 h-5 items-center justify-center">
          <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
});

// Memoized todo chip for day header
const DayTodoChip = memo(function DayTodoChip({ todo }: { todo: Todo }) {
  const catIcon = getCategoryInfo(todo.category).icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 max-w-full min-w-0 text-xs px-2 py-0.5 rounded-full",
        todo.completed
          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 line-through"
          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
      )}
    >
      <span className="shrink-0 leading-none select-none" aria-hidden>{catIcon}</span>
      <span className="truncate min-w-0">{todo.title}</span>
    </span>
  );
});

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  eventsByDate: Map<string, CalendarEvent[]>;
  todosByDate: Map<string, Todo[]>;
  currentTimeTop: number;
  currentMinutes: number;
  timelineRef: React.RefObject<HTMLDivElement>;
  onAddEvent: () => void;
  onDeleteEvent: (id: number) => void;
  onEventClick?: (ev: CalendarEvent) => void;
}

export default function DayView({
  currentDate,
  eventsByDate,
  todosByDate,
  currentTimeTop,
  currentMinutes,
  timelineRef,
  onAddEvent,
  onDeleteEvent,
  onEventClick,
}: DayViewProps) {
  const { t } = useI18n();
  const dateKey = format(currentDate, "yyyy-MM-dd");
  const dayEvents = eventsByDate.get(dateKey) || [];
  const dayTodos = todosByDate.get(dateKey) || [];
  // All-day / multi-day events go in a top lane; only timed events sit on the grid.
  const allDayEvents = dayEvents.filter(isAllDayLike);
  const timedEvents = dayEvents.filter((e) => !isAllDayLike(e));
  const layout = packColumns(timedEvents);

  return (
    <>
      {/* Day header with todos */}
      <div className="border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {dayEvents.length} events
            {dayTodos.length > 0 && (
              <span className="ml-2">
                · {dayTodos.length} todos
              </span>
            )}
          </span>
          <button onClick={onAddEvent} className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {/* All-day / multi-day events lane */}
        {allDayEvents.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {allDayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEventClick?.(ev)}
                className="inline-flex items-center gap-1.5 max-w-full min-w-0 text-xs px-2 py-1 rounded-md cursor-pointer"
                style={{ backgroundColor: (ev.color || "#3b82f6") + "22", color: ev.color || "#3b82f6" }}
              >
                <span className="truncate min-w-0 font-medium">{ev.title}</span>
                <span className="shrink-0 opacity-70 tabular-nums">{eventTimeLabel(ev, t("calendar.allDay"))}</span>
              </button>
            ))}
          </div>
        )}
        {/* Todos for this day */}
        {dayTodos.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {dayTodos.map((td) => (
              <DayTodoChip key={td.id} todo={td} />
            ))}
          </div>
        )}
      </div>
      <div ref={timelineRef} className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          {HOURS.map((hour) => (
            <div key={hour} className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/50" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
              <span className="absolute -top-2.5 left-2 text-xs text-slate-400 dark:text-slate-500 w-10">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
          {isToday(currentDate) && currentMinutes >= START_HOUR * 60 && (
            <div className="absolute left-12 right-2 z-10 flex items-center pointer-events-none" style={{ top: currentTimeTop }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          )}
          {timedEvents.map((ev) => {
            const pos = layout.get(ev.id) || { col: 0, cols: 1 };
            return (
              <DayEventItem key={ev.id} ev={ev} onDelete={onDeleteEvent} onClick={onEventClick} col={pos.col} cols={pos.cols} />
            );
          })}
        </div>
      </div>
    </>
  );
}
