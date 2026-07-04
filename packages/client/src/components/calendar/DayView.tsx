import React, { memo, useRef, useState } from "react";
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
  minutesToHHMM,
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
  ev, onDelete, onPointerDownBody, onResizeStart, col, cols, overrideStartMin, overrideEndMin, dragging,
}: {
  ev: CalendarEvent;
  onDelete: (id: number) => void;
  onPointerDownBody?: (e: React.PointerEvent, ev: CalendarEvent) => void;
  onResizeStart?: (e: React.PointerEvent, ev: CalendarEvent) => void;
  col: number;
  cols: number;
  overrideStartMin?: number;
  overrideEndMin?: number;
  dragging?: boolean;
}) {
  const startMin = overrideStartMin ?? timeToMinutes(ev.startTime.slice(11, 16));
  const endMin = overrideEndMin ?? timeToMinutes(ev.endTime.slice(11, 16));
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
      className={cn(
        "absolute rounded-lg border-l-4 px-3 py-1.5 group touch-none select-none cursor-grab active:cursor-grabbing",
        dragging && "z-20 shadow-lg opacity-90",
      )}
      style={{ top, height, left, width, borderLeftColor: ev.color || "#3b82f6", backgroundColor: (ev.color || "#3b82f6") + "18" }}
      onPointerDown={(e) => onPointerDownBody?.(e, ev)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
          {height >= 40 && <p className="text-xs text-slate-400">{minutesToHHMM(startMin)} - {minutesToHHMM(endMin)}</p>}
        </div>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }} className="hidden group-hover:flex w-5 h-5 items-center justify-center">
          <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
        </button>
      </div>
      {/* Resize handle (bottom edge) */}
      <div
        onPointerDown={(e) => onResizeStart?.(e, ev)}
        className="absolute left-0 right-0 -bottom-1 h-2.5 cursor-ns-resize"
      >
        <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-slate-400/0 group-hover:bg-slate-400/60" />
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
  /** Drag on empty timeline to create; args are "HH:MM" start/end. */
  onCreateAt?: (startHHMM: string, endHHMM: string) => void;
  /** Commit a move/resize; ISO strings anchored to the event's own date. */
  onUpdateTime?: (id: number, startISO: string, endISO: string) => void;
}

type DragState =
  | { kind: "create"; startMin: number; curMin: number }
  | { kind: "move"; id: number; start: number; end: number }
  | { kind: "resize"; id: number; start: number; end: number }
  | null;

const SNAP = 15; // minutes

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
  onCreateAt,
  onUpdateTime,
}: DayViewProps) {
  const { t } = useI18n();
  const dateKey = format(currentDate, "yyyy-MM-dd");
  const dayEvents = eventsByDate.get(dateKey) || [];
  const dayTodos = todosByDate.get(dateKey) || [];
  // All-day / multi-day events go in a top lane; only timed events sit on the grid.
  const allDayEvents = dayEvents.filter(isAllDayLike);
  const timedEvents = dayEvents.filter((e) => !isAllDayLike(e));
  const layout = packColumns(timedEvents);

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);

  const yToMin = (clientY: number): number => {
    const el = gridRef.current;
    if (!el) return START_HOUR * 60;
    const rect = el.getBoundingClientRect();
    let m = START_HOUR * 60 + ((clientY - rect.top) / HOUR_HEIGHT) * 60;
    m = Math.round(m / SNAP) * SNAP;
    return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, m));
  };

  const isoFor = (ev: CalendarEvent, min: number) => `${ev.startTime.slice(0, 11)}${minutesToHHMM(min)}:00`;

  // Drag on empty timeline background → create event.
  const startCreate = (e: React.PointerEvent) => {
    if (e.button !== 0 || !onCreateAt) return;
    // Only start when the background itself is the target (not an event).
    if (e.target !== e.currentTarget) return;
    const startMin = yToMin(e.clientY);
    let cur = startMin;
    setDrag({ kind: "create", startMin, curMin: startMin });
    const onMove = (mv: PointerEvent) => {
      cur = yToMin(mv.clientY);
      setDrag({ kind: "create", startMin, curMin: cur });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);
      const a = Math.min(startMin, cur);
      const b = Math.max(startMin, cur);
      onCreateAt(minutesToHHMM(a), minutesToHHMM(b >= a + SNAP ? b : a + 60));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Drag an event body → move; drag its bottom handle → resize.
  const startEventDrag = (e: React.PointerEvent, ev: CalendarEvent, mode: "move" | "resize") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origStart = timeToMinutes(ev.startTime.slice(11, 16));
    const origEnd = timeToMinutes(ev.endTime.slice(11, 16));
    const dur = origEnd - origStart;
    const startY = e.clientY;
    let moved = false;
    let curStart = origStart;
    let curEnd = origEnd;
    setDrag({ kind: mode, id: ev.id, start: origStart, end: origEnd });
    const onMove = (mv: PointerEvent) => {
      if (Math.abs(mv.clientY - startY) > 4) moved = true;
      const dm = Math.round(((mv.clientY - startY) / HOUR_HEIGHT * 60) / SNAP) * SNAP;
      if (mode === "move") {
        curStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - dur, origStart + dm));
        curEnd = curStart + dur;
      } else {
        curEnd = Math.max(origStart + SNAP, Math.min(END_HOUR * 60, origEnd + dm));
      }
      setDrag({ kind: mode, id: ev.id, start: curStart, end: curEnd });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);
      if (!moved) { onEventClick?.(ev); return; }
      if ((curStart !== origStart || curEnd !== origEnd) && onUpdateTime) {
        onUpdateTime(ev.id, isoFor(ev, curStart), isoFor(ev, curEnd));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const createDraft = drag?.kind === "create" ? drag : null;
  const draftTop = createDraft ? ((Math.min(createDraft.startMin, createDraft.curMin) - START_HOUR * 60) / 60) * HOUR_HEIGHT : 0;
  const draftHeight = createDraft ? (Math.abs(createDraft.curMin - createDraft.startMin) / 60) * HOUR_HEIGHT : 0;

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
        <div
          ref={gridRef}
          className="relative"
          style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
          onPointerDown={startCreate}
        >
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
          {/* Ghost selection while drag-creating */}
          {createDraft && draftHeight > 1 && (
            <div
              className="absolute left-14 right-3 rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none z-20 flex items-center justify-center"
              style={{ top: draftTop, height: draftHeight }}
            >
              <span className="text-xs font-medium text-blue-600 dark:text-blue-300 tabular-nums">
                {minutesToHHMM(Math.min(createDraft.startMin, createDraft.curMin))} - {minutesToHHMM(Math.max(createDraft.startMin, createDraft.curMin))}
              </span>
            </div>
          )}
          {timedEvents.map((ev) => {
            const pos = layout.get(ev.id) || { col: 0, cols: 1 };
            const active = drag && (drag.kind === "move" || drag.kind === "resize") && drag.id === ev.id ? drag : null;
            return (
              <DayEventItem
                key={ev.id}
                ev={ev}
                onDelete={onDeleteEvent}
                onPointerDownBody={(e, ee) => startEventDrag(e, ee, "move")}
                onResizeStart={(e, ee) => startEventDrag(e, ee, "resize")}
                col={pos.col}
                cols={pos.cols}
                overrideStartMin={active ? active.start : undefined}
                overrideEndMin={active ? active.end : undefined}
                dragging={!!active}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
