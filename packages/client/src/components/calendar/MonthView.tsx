import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { format, isSameMonth, isSameDay, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { Plus, X, CheckSquare, Calendar, Pencil, Trash2, Check, Repeat, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { getCategoryInfo } from "@/lib/categories";
import { useI18n } from "@/lib/useI18n";
import { eventTimeLabel } from "@/lib/eventFormat";
import type { CalendarEvent, Todo, HoverTooltipItem } from "./calendarTypes";
import HoverTooltip from "./HoverTooltip";

// Resizable split between the calendar grid and the selected-date detail panel.
const SPLIT_STORAGE_KEY = "timebox_calendar_split";
const DEFAULT_SPLIT = 0.5; // calendar : detail = 1 : 1
const MIN_SPLIT = 0.15;
const MAX_SPLIT = 0.85;

// Memoized event item in the selected-date detail panel
const MonthEventDetailItem = memo(function MonthEventDetailItem({
  ev, onDeleteEvent, onEditEvent, projectLabel,
}: {
  ev: CalendarEvent;
  onDeleteEvent: (id: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  projectLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors">
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex items-center gap-1">{ev.title}{ev.recurrenceRule && <Repeat className="w-3 h-3 text-slate-400 shrink-0" />}</p>
        <p className="text-[11px] text-slate-400 tabular-nums">{eventTimeLabel(ev, t("calendar.allDay"))}</p>
        {projectLabel && (
          <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate mt-0.5">{projectLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
        {onEditEvent && (
          <button onClick={() => onEditEvent(ev)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
            <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
          </button>
        )}
        <button onClick={() => onDeleteEvent(ev.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
});

// Memoized todo item in the selected-date detail panel
const MonthTodoDetailItem = memo(function MonthTodoDetailItem({
  td, onToggleTodo, onDeleteTodo, onEditTodo, projectLabel, innerRef, style, dragHandleProps, dragging,
}: {
  td: Todo;
  onToggleTodo?: (id: number) => void;
  onDeleteTodo?: (id: number) => void;
  onEditTodo?: (todo: Todo) => void;
  projectLabel?: string;
  innerRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const catIcon = getCategoryInfo(td.category).icon;
  return (
    <div ref={innerRef} style={style} className={cn("group flex items-center gap-2 px-4 py-2.5 hover:bg-amber-50/30 dark:hover:bg-slate-700/40 transition-colors bg-white dark:bg-slate-800", dragging && "shadow-lg")}>
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 -ml-1 p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          aria-label="reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {onToggleTodo ? (
        <button onClick={() => onToggleTodo(td.id)} className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", td.completed ? "bg-green-500 border-green-500" : "border-slate-300 dark:border-slate-600 hover:border-amber-400")}>
          {td.completed && <Check className="w-3 h-3 text-white" />}
        </button>
      ) : (
        <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", td.completed ? "bg-green-400" : "bg-amber-400")} />
      )}
      <CheckSquare className={cn("w-3.5 h-3.5 flex-shrink-0", td.completed ? "text-green-500" : "text-amber-500")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate flex items-center gap-1.5 min-w-0", td.completed ? "line-through text-slate-400" : "font-medium text-slate-900 dark:text-white")}>
          <span className="shrink-0 text-sm leading-none select-none" aria-hidden>{catIcon}</span>
          <span className="truncate min-w-0">{td.title}</span>
        </p>
        <p className="text-[11px] text-slate-400">
          {td.priority === "high" ? "High" : td.priority === "medium" ? "Medium" : "Low"}
          {projectLabel && <span className="text-blue-600 dark:text-blue-400 ml-2">· {projectLabel}</span>}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
        {onEditTodo && (
          <button onClick={() => onEditTodo(td)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
            <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
          </button>
        )}
        {onDeleteTodo && (
          <button onClick={() => onDeleteTodo(td.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
});

// Sortable wrapper for a todo row in the selected-date detail panel.
const SortableTodoRow = memo(function SortableTodoRow({
  td, onToggleTodo, onDeleteTodo, onEditTodo, projectLabel,
}: {
  td: Todo;
  onToggleTodo?: (id: number) => void;
  onDeleteTodo?: (id: number) => void;
  onEditTodo?: (todo: Todo) => void;
  projectLabel?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: td.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <MonthTodoDetailItem
      td={td}
      onToggleTodo={onToggleTodo}
      onDeleteTodo={onDeleteTodo}
      onEditTodo={onEditTodo}
      projectLabel={projectLabel}
      innerRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragging={isDragging}
    />
  );
});

interface MonthViewProps {
  days: Date[];
  currentDate: Date;
  selectedDate: Date | null;
  eventsByDate: Map<string, CalendarEvent[]>;
  todosByDate: Map<string, Todo[]>;
  selectedDateEvents: CalendarEvent[];
  selectedDateTodos: Todo[];
  onSelectDate: (date: Date) => void;
  onDoubleClickDate: (date: Date) => void;
  hoverDateKey: string | null;
  getHoverItems: (dateKey: string) => HoverTooltipItem[];
  onDayHover: (e: React.MouseEvent, dateKey: string) => void;
  onDayLeave: () => void;
  onShowAddModal: () => void;
  onAddTodo?: () => void;
  onDeleteEvent: (id: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onToggleTodo?: (id: number) => void;
  onDeleteTodo?: (id: number) => void;
  onEditTodo?: (todo: Todo) => void;
  onLongPressDate?: (date: Date, type: string) => void;
  /** Persist a manual reorder of the selected day's todos. */
  onReorderTodos?: (items: { id: number; sortOrder: number }[]) => void;
  /** Remaining (upcoming) events + todos grouped by date, for the bottom overview. */
  bottomAgenda?: { dateKey: string; day: Date; events: CalendarEvent[]; todos: Todo[] }[];
  /** "month" = through end of month, "upcoming" = all future (label only). */
  bottomScope?: "month" | "upcoming";
  /** projectId → display name for linked personal items */
  projectNameById?: Record<number, string>;
}

export default function MonthView({
  days,
  currentDate,
  selectedDate,
  eventsByDate,
  todosByDate,
  selectedDateEvents,
  selectedDateTodos,
  onSelectDate,
  onDoubleClickDate,
  hoverDateKey,
  getHoverItems,
  onDayHover,
  onDayLeave,
  onShowAddModal,
  onAddTodo,
  onDeleteEvent,
  onEditEvent,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onLongPressDate,
  onReorderTodos,
  bottomAgenda = [],
  bottomScope = "month",
  projectNameById = {},
}: MonthViewProps) {
  const { t } = useI18n();
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Drag-reorder the selected day's todos; persist via onReorderTodos.
  const handleTodoDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = selectedDateTodos.map((t) => t.id);
    const oldI = ids.indexOf(Number(active.id));
    const newI = ids.indexOf(Number(over.id));
    if (oldI < 0 || newI < 0) return;
    const reordered = arrayMove(ids, oldI, newI);
    onReorderTodos?.(reordered.map((id, index) => ({ id, sortOrder: index })));
  }, [selectedDateTodos, onReorderTodos]);
  const [longPressDate, setLongPressDate] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once a long-press has fired, so the trailing click doesn't also open the day.
  const longPressFired = useRef(false);
  // Bottom panel: "agenda" = month/upcoming overview, "day" = one day's detail.
  const [detailMode, setDetailMode] = useState<"agenda" | "day">("agenda");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const openDay = useCallback((d: Date) => { onSelectDate(d); setDetailMode("day"); }, [onSelectDate]);
  const agendaCount = useMemo(
    () => bottomAgenda.reduce((n, g) => n + g.events.length + g.todos.length, 0),
    [bottomAgenda],
  );

  // Resizable calendar / detail split (defaults to a 1:1 ratio).
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Persisted in localStorage so the user's chosen split ratio is kept across
  // sessions and reloads (clamped to the allowed range; falls back to 1:1).
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem(SPLIT_STORAGE_KEY) || "");
    return saved >= MIN_SPLIT && saved <= MAX_SPLIT ? saved : DEFAULT_SPLIT;
  });

  useEffect(() => {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(splitRatio));
  }, [splitRatio]);

  // On short viewports (landscape phones) the total height is tiny, so a 1:1
  // split leaves the month grid with only ~2 rows. Bias the split toward the
  // grid there without touching the user's saved ratio.
  const [isShort, setIsShort] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-height: 500px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-height: 500px)");
    const onChange = () => setIsShort(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const gridGrow = isShort ? Math.max(splitRatio, 0.68) : splitRatio;

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const apply = (clientY: number) => {
      const grid = gridRef.current;
      const container = containerRef.current;
      if (!grid || !container) return;
      const top = grid.getBoundingClientRect().top; // top of the flexible area
      const bottom = container.getBoundingClientRect().bottom;
      const avail = bottom - top;
      if (avail <= 0) return;
      const ratio = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, (clientY - top) / avail));
      setSplitRatio(ratio);
    };
    const onMove = (ev: PointerEvent) => apply(ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
          <div key={day} className={cn("text-center text-xs font-medium py-2 short:py-0.5", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500")}>
            {day}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="min-h-0 overflow-y-auto grid grid-cols-7 auto-rows-[minmax(3.2rem,4.5rem)] short:auto-rows-[minmax(2.1rem,2.6rem)]"
        style={(selectedDate || isShort) ? { flexGrow: gridGrow, flexShrink: 1, flexBasis: 0 } : undefined}
      >
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const dayTodos = todosByDate.get(dateKey) || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dow = day.getDay();
          return (
            <button
              key={dateKey}
              onClick={() => {
                // A long-press just fired its menu — swallow the trailing tap.
                if (longPressFired.current) { longPressFired.current = false; return; }
                openDay(day);
              }}
              onDoubleClick={() => onDoubleClickDate(day)}
              onTouchStart={(e) => {
                longPressFired.current = false;
                const target = e.currentTarget;
                touchTimer.current = setTimeout(() => {
                  longPressFired.current = true;
                  const rect = target.getBoundingClientRect();
                  setLongPressDate(dateKey);
                  setMenuPos({ x: rect.left + rect.width / 2, y: rect.top });
                  // Clear text selection
                  window.getSelection()?.removeAllRanges();
                }, 500);
              }}
              onTouchEnd={() => {
                if (touchTimer.current) clearTimeout(touchTimer.current);
              }}
              onTouchMove={() => {
                if (touchTimer.current) clearTimeout(touchTimer.current);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setLongPressDate(dateKey);
                setMenuPos({ x: rect.left + rect.width / 2, y: rect.top });
              }}
              onMouseEnter={(e) => onDayHover(e, dateKey)}
              onMouseLeave={onDayLeave}
              className={cn(
                "relative flex flex-col items-start p-1 border-b border-r border-slate-100 dark:border-slate-700/50 transition-colors overflow-hidden select-none",
                !isSameMonth(day, currentDate) && "opacity-30",
                isSelected && "bg-blue-50 dark:bg-blue-900/20",
                !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-700/30",
              )}
            >
              <span className={cn(
                "w-6 h-6 flex items-center justify-center rounded-full text-xs shrink-0",
                isToday(day) && "bg-blue-600 text-white font-bold",
                !isToday(day) && dow === 0 && "text-red-500",
                !isToday(day) && dow === 6 && "text-blue-500",
                !isToday(day) && dow !== 0 && dow !== 6 && "text-slate-700 dark:text-slate-300",
              )}>
                {format(day, "d")}
              </span>
              {/* Event & todo titles */}
              <div className="w-full mt-0.5 space-y-0.5 overflow-hidden flex-1 min-h-0">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={`e-${ev.id}`} className="flex items-center gap-0.5 px-0.5 min-w-0">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                    {ev.projectId && projectNameById[ev.projectId] && (
                      <span className="w-1 h-1 rounded-full shrink-0 bg-blue-500" title={projectNameById[ev.projectId]} />
                    )}
                    {ev.recurrenceRule && <Repeat className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                    <p className="text-[10px] leading-tight truncate text-slate-700 dark:text-slate-300">{ev.title}</p>
                  </div>
                ))}
                {dayTodos.slice(0, 3).map((td) => (
                  <div key={`t-${td.id}`} className="flex items-center gap-0.5 px-0.5 min-w-0">
                    <div className={cn("w-1 h-1 rounded-sm shrink-0", td.completed ? "bg-green-400" : "bg-amber-400")} />
                    {td.projectId && projectNameById[td.projectId] && (
                      <span className="w-1 h-1 rounded-full shrink-0 bg-blue-500" title={projectNameById[td.projectId]} />
                    )}
                    <span className="shrink-0 text-[9px] leading-none select-none" aria-hidden>{getCategoryInfo(td.category).icon}</span>
                    <p className={cn("text-[10px] leading-tight truncate min-w-0", td.completed ? "line-through text-slate-400" : "text-slate-600 dark:text-slate-400")}>{td.title}</p>
                  </div>
                ))}
                {(() => {
                  const shown = Math.min(dayEvents.length, 3) + Math.min(dayTodos.length, 3);
                  const hidden = dayEvents.length + dayTodos.length - shown;
                  return hidden > 0 ? (
                    <span className="text-[9px] font-medium text-slate-400 px-0.5">+{hidden} {t("calendar.more")}</span>
                  ) : null;
                })()}
              </div>
              {hoverDateKey === dateKey && (dayEvents.length > 0 || dayTodos.length > 0) && (
                <HoverTooltip items={getHoverItems(dateKey)} />
              )}
            </button>
          );
        })}
      </div>
      {/* Long-press quick-add menu */}
      {longPressDate && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLongPressDate(null)} />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px] animate-in"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase">
              {longPressDate.slice(5)} {t("calendar.quickAdd")}
            </p>
            {[
              { type: "event", icon: "\u{1F4C5}", label: t("calendar.addEvent") },
              { type: "todo", icon: "\u2705", label: t("calendar.addTodo") },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  onLongPressDate?.(new Date(longPressDate), item.type);
                  setLongPressDate(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Drag handle to resize the calendar / detail split */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("calendar.resizePanel") || "Resize panel"}
        onPointerDown={onResizeStart}
        onDoubleClick={() => setSplitRatio(DEFAULT_SPLIT)}
        title={t("calendar.resizePanelHint") || "Drag to resize · double-click to reset"}
        className="group relative flex-shrink-0 h-2.5 cursor-row-resize flex items-center justify-center bg-slate-100 dark:bg-slate-700/40 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors touch-none"
      >
        <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500" />
      </div>

      {/* Bottom panel — upcoming overview (agenda) or one-day detail */}
      <div
        className="flex flex-col border-blue-500/30 dark:border-blue-400/20 bg-white dark:bg-slate-800"
        style={{ flexGrow: 1 - gridGrow, flexShrink: 1, flexBasis: 0, minHeight: 0 }}
      >
        {/* Header: mode tabs + add */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => setDetailMode("agenda")}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap",
                detailMode === "agenda"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60",
              )}
            >
              {bottomScope === "upcoming" ? (t("calendar.upcoming") || "다가오는") : (t("calendar.thisMonth") || "이 달")}
              {agendaCount > 0 && (
                <span className={cn("text-[10px] px-1 rounded-full tabular-nums", detailMode === "agenda" ? "bg-white/25" : "bg-slate-200/70 dark:bg-slate-700")}>{agendaCount}</span>
              )}
            </button>
            {selectedDate && (
              <button
                onClick={() => setDetailMode("day")}
                className={cn(
                  "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap",
                  detailMode === "day"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60",
                )}
              >
                {format(selectedDate, "M/d (EEE)", { locale: enUS })}
                {(selectedDateEvents.length + selectedDateTodos.length) > 0 && (
                  <span className={cn("text-[10px] px-1 rounded-full tabular-nums", detailMode === "day" ? "bg-white/25" : "bg-slate-200/70 dark:bg-slate-700")}>{selectedDateEvents.length + selectedDateTodos.length}</span>
                )}
              </button>
            )}
          </div>
          {/* Add menu: event or todo */}
          <div className="relative shrink-0">
            <button onClick={() => setAddMenuOpen((v) => !v)} className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-sm transition-colors" aria-label="Add">
              <Plus className="w-4 h-4" />
            </button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-50 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in">
                  <button
                    onClick={() => { setAddMenuOpen(false); onShowAddModal(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <Calendar className="w-4 h-4 text-blue-500" /> {t("calendar.addEvent")}
                  </button>
                  <button
                    onClick={() => { setAddMenuOpen(false); onAddTodo?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <CheckSquare className="w-4 h-4 text-amber-500" /> {t("calendar.addTodo")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {detailMode === "agenda" ? (
            /* ── Upcoming overview: remaining events + todos grouped by date ── */
            bottomAgenda.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">{t("calendar.noUpcoming") || "다가오는 일정이 없습니다"}</p>
              </div>
            ) : (
              <div className="pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px)+8px)] sm:pb-2">
                {bottomAgenda.map((group) => (
                  <div key={group.dateKey} className="border-b border-slate-100 dark:border-slate-700/30">
                    <button
                      onClick={() => openDay(group.day)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 bg-slate-50/70 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors sticky top-0 z-[1]"
                    >
                      <span className={cn("text-xs font-semibold", isToday(group.day) ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-300")}>
                        {format(group.day, "M/d (EEE)", { locale: enUS })}
                      </span>
                      {isToday(group.day) && <span className="text-[9px] px-1 rounded bg-blue-600 text-white font-semibold">{t("calendar.today") || "오늘"}</span>}
                      <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{group.events.length + group.todos.length}</span>
                    </button>
                    {group.events.map((ev) => (
                      <MonthEventDetailItem
                        key={`ev-${ev.id}`}
                        ev={ev}
                        onDeleteEvent={onDeleteEvent}
                        onEditEvent={onEditEvent}
                        projectLabel={ev.projectId ? projectNameById[ev.projectId] : undefined}
                      />
                    ))}
                    {group.todos.map((td) => (
                      <MonthTodoDetailItem
                        key={`td-${td.id}`}
                        td={td}
                        projectLabel={td.projectId ? projectNameById[td.projectId] : undefined}
                        onToggleTodo={onToggleTodo}
                        onDeleteTodo={onDeleteTodo}
                        onEditTodo={onEditTodo}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )
          ) : /* ── One-day detail (시간별 by time) ── */
          !selectedDate ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600 py-8">
              <p className="text-xs">{t("calendar.selectDateHint") || "Tap a date to see details"}</p>
            </div>
          ) : selectedDateEvents.length === 0 && selectedDateTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Calendar className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs">{t("calendar.noEvents")}</p>
              <button onClick={onShowAddModal} className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium">
                + {t("calendar.addEvent")}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/30 pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px)+8px)] sm:pb-2">
              {selectedDateEvents.map((ev) => (
                <MonthEventDetailItem
                  key={`ev-${ev.id}`}
                  ev={ev}
                  onDeleteEvent={onDeleteEvent}
                  onEditEvent={onEditEvent}
                  projectLabel={ev.projectId ? projectNameById[ev.projectId] : undefined}
                />
              ))}
              {/* Todos — drag to reorder (order persists) */}
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTodoDragEnd}>
                <SortableContext items={selectedDateTodos.map((td) => td.id)} strategy={verticalListSortingStrategy}>
                  {selectedDateTodos.map((td) => (
                    <SortableTodoRow
                      key={`td-${td.id}`}
                      td={td}
                      projectLabel={td.projectId ? projectNameById[td.projectId] : undefined}
                      onToggleTodo={onToggleTodo}
                      onDeleteTodo={onDeleteTodo}
                      onEditTodo={onEditTodo}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
