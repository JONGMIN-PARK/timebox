import { useEffect, useState, useRef, useMemo, memo, useCallback } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, Trash2, Pencil,
  Calendar, CheckSquare, Clock, PanelRightOpen, PanelRightClose, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { usePageVisible } from "@/lib/useVisibility";
import { getCategoryInfo } from "@/lib/categories";
import { showToast } from "@/components/ui/Toast";
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
  type TimeBlock,
} from "@/stores/timeblockStore";
import { useEventStore } from "@/stores/eventStore";
import { useTodoStore } from "@/stores/todoStore";
import CalendarTodoAddModal from "@/components/calendar/CalendarTodoAddModal";
import CalendarTodoEditModal from "@/components/calendar/CalendarTodoEditModal";
import TimeStats from "./TimeStats";
import { loadBrainItems, saveBrainItems, uid, type BrainItem } from "@/components/scheduler/elonStorage";
import type { CalendarEvent, Todo } from "@timebox/shared";

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 6;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function blockTop(startTime: string): number {
  const minutes = timeToMinutes(startTime);
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function blockHeight(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return ((end - start) / 60) * HOUR_HEIGHT;
}

// Memoized time block item to avoid re-rendering all blocks when one changes
const TimeBlockItem = memo(function TimeBlockItem({
  block,
  onToggleCompleted,
  onDeleteBlock,
}: {
  block: TimeBlock;
  onToggleCompleted: (id: number) => void;
  onDeleteBlock: (id: number) => void;
}) {
  const catConfig = CATEGORY_CONFIG[block.category];
  const color = block.color || catConfig.color;
  const top = blockTop(block.startTime);
  const height = blockHeight(block.startTime, block.endTime);

  return (
    <div
      className={cn(
        "absolute left-14 right-2 rounded-lg border-l-4 px-3 py-1.5 cursor-pointer group transition-opacity",
        block.completed && "opacity-50",
      )}
      style={{
        top,
        height: Math.max(height, 24),
        borderLeftColor: color,
        backgroundColor: color + "18",
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate",
              block.completed
                ? "line-through text-slate-400 dark:text-slate-500"
                : "text-slate-900 dark:text-white",
            )}
          >
            {catConfig.icon} {block.title}
          </p>
          {height >= 40 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {block.startTime} - {block.endTime}
            </p>
          )}
        </div>
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={() => onToggleCompleted(block.id)}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center",
              block.completed
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
            )}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteBlock(block.id)}
            className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 flex items-center justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

// Memoized event item rendered on the timeline (for calendar events without a matching time block)
const TimelineEventItem = memo(function TimelineEventItem({
  ev, onSchedule,
}: {
  ev: CalendarEvent;
  onSchedule: (title: string, start: string, end: string) => void;
}) {
  const startH = ev.startTime.slice(11, 16);
  const endH = ev.endTime.slice(11, 16);
  if (!startH || !endH) return null;
  const color = ev.color || "#3b82f6";
  const top = blockTop(startH);
  const height = blockHeight(startH, endH);

  return (
    <div
      className="absolute left-14 right-2 rounded-lg border-l-4 border-dashed px-3 py-1.5 cursor-pointer group"
      style={{
        top,
        height: Math.max(height, 24),
        borderLeftColor: color,
        backgroundColor: color + "12",
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-300">
            <Calendar className="w-3 h-3 inline-block mr-1 -mt-0.5" />
            {ev.title}
          </p>
          {height >= 40 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {startH} - {endH}
            </p>
          )}
        </div>
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={() => onSchedule(ev.title, startH, endH)}
            title="Schedule as block"
            className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-blue-500 flex items-center justify-center"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Side panel event item ──
const PanelEventItem = memo(function PanelEventItem({
  ev, onSchedule, onDelete,
}: {
  ev: CalendarEvent;
  onSchedule: (title: string, start: string, end: string) => void;
  onDelete: (id: number) => void;
}) {
  const startH = ev.startTime.slice(11, 16);
  const endH = ev.endTime.slice(11, 16);
  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-blue-50/50 dark:hover:bg-slate-700/40 rounded-lg transition-colors">
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
        {!ev.allDay && <p className="text-[11px] text-slate-400 tabular-nums">{startH} – {endH}</p>}
        {ev.allDay && <p className="text-[11px] text-slate-400">All day</p>}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
        {!ev.allDay && (
          <button
            onClick={() => onSchedule(ev.title, startH, endH)}
            title="Schedule as block"
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </button>
        )}
        <button
          onClick={() => onDelete(ev.id)}
          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
});

// ── Side panel todo item ──
const PanelTodoItem = memo(function PanelTodoItem({
  td, onToggle, onSchedule, onDelete, onEdit,
}: {
  td: Todo;
  onToggle: (id: number) => void;
  onSchedule: (title: string) => void;
  onDelete: (id: number) => void;
  onEdit: (todo: Todo) => void;
}) {
  const catIcon = getCategoryInfo(td.category).icon;
  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-amber-50/30 dark:hover:bg-slate-700/40 rounded-lg transition-colors">
      <button
        onClick={() => onToggle(td.id)}
        className={cn(
          "w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          td.completed ? "bg-green-500 border-green-500" : "border-slate-300 dark:border-slate-600 hover:border-amber-400",
        )}
      >
        {td.completed && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] truncate flex items-center gap-1 min-w-0",
          td.completed ? "line-through text-slate-400" : "font-medium text-slate-900 dark:text-white")}>
          <span className="shrink-0 text-sm leading-none select-none">{catIcon}</span>
          <span className="truncate min-w-0">{td.title}</span>
        </p>
        <p className="text-[11px] text-slate-400">
          {td.priority === "high" ? "🔴" : td.priority === "medium" ? "🟡" : "🔵"} {td.priority}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
        {!td.completed && (
          <button
            onClick={() => onSchedule(td.title)}
            title="Schedule as block"
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </button>
        )}
        <button
          onClick={() => onEdit(td)}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
        </button>
        <button
          onClick={() => onDelete(td.id)}
          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
});

export default function TimeBoxView() {
  const { blocks, loading, selectedDate, setSelectedDate, fetchBlocks, addBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();
  const { events, fetchEvents, deleteEvent, addEvent } = useEventStore();
  const { todos, fetchTodos, toggleTodo, deleteTodo, addTodo, updateTodo } = useTodoStore();
  const { t } = useI18n();

  const pageVisible = usePageVisible();
  const [showAddForm, setShowAddForm] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem("tb_panel_open") !== "false"; } catch { return true; }
  });
  const [newBlock, setNewBlock] = useState({
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    category: "deep_work" as TimeBlockCategory,
  });
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState("09:00");
  const [newEventEnd, setNewEventEnd] = useState("10:00");
  const [todoAddOpen, setTodoAddOpen] = useState(false);
  const [todoEditOpen, setTodoEditOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [brainItems, setBrainItems] = useState<BrainItem[]>([]);
  const [newIdeaText, setNewIdeaText] = useState("");
  const [brainOpen, setBrainOpen] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlocks(selectedDate);
    fetchTodos();
  }, []);

  useEffect(() => {
    fetchEvents(`${selectedDate}T00:00:00`, `${selectedDate}T23:59:59`);
  }, [selectedDate]);

  useEffect(() => {
    setBrainItems(loadBrainItems(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    try { localStorage.setItem("tb_panel_open", String(panelOpen)); } catch { /* */ }
  }, [panelOpen]);

  // Auto-navigate to today when page becomes visible and date has changed
  useEffect(() => {
    if (pageVisible) {
      const today = format(new Date(), "yyyy-MM-dd");
      if (selectedDate !== today) {
        setSelectedDate(today);
      }
    }
  }, [pageVisible]);

  // Scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current && isToday(parseISO(selectedDate))) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100;
      timelineRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [selectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [blocks],
  );

  const dayEvents = useMemo(() =>
    events.filter(ev => {
      const evDate = ev.startTime.slice(0, 10);
      return evDate === selectedDate;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDate],
  );

  const dayTodos = useMemo(() =>
    todos.filter(td => td.dueDate === selectedDate && !td.deletedAt)
      .sort((a, b) => {
        // Incomplete first, then by priority
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pri = { high: 0, medium: 1, low: 2 } as Record<string, number>;
        return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
      }),
    [todos, selectedDate],
  );

  // Events that don't already have a matching time block (avoid duplicates on timeline)
  const timelineEvents = useMemo(() => {
    const blockTitles = new Set(sortedBlocks.map(b => `${b.title}|${b.startTime}`));
    return dayEvents.filter(ev => {
      if (ev.allDay) return false;
      const startH = ev.startTime.slice(11, 16);
      return !blockTitles.has(`${ev.title}|${startH}`);
    });
  }, [dayEvents, sortedBlocks]);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showCurrentTime = isToday(parseISO(selectedDate)) && currentMinutes >= START_HOUR * 60;
  const currentTimeTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  // Memoize category duration computation for stats bar
  const categoryDurations = useMemo(() =>
    sortedBlocks.reduce(
      (acc, b) => {
        const dur = timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
        acc[b.category] = (acc[b.category] || 0) + dur;
        return acc;
      },
      {} as Record<string, number>,
    ), [sortedBlocks]);

  const handleToggleCompleted = useCallback((id: number) => toggleCompleted(id), [toggleCompleted]);
  const handleDeleteBlock = useCallback((id: number) => deleteBlock(id), [deleteBlock]);

  const findOverlap = (start: string, end: string) => {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    return sortedBlocks.find(b => {
      const bs = timeToMinutes(b.startTime);
      const be = timeToMinutes(b.endTime);
      return s < be && e > bs;
    }) || null;
  };

  const confirmOverlap = (start: string, end: string): boolean => {
    const overlap = findOverlap(start, end);
    if (!overlap) return true;
    const msg = t("timebox.overlapWarning")
      .replace("{title}", overlap.title)
      .replace("{start}", overlap.startTime)
      .replace("{end}", overlap.endTime);
    return window.confirm(msg);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlock.title.trim()) return;
    if (!confirmOverlap(newBlock.startTime, newBlock.endTime)) return;
    const catConfig = CATEGORY_CONFIG[newBlock.category];
    await addBlock({
      date: selectedDate,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      title: newBlock.title.trim(),
      category: newBlock.category,
      color: catConfig.color,
    });
    setNewBlock({ title: "", startTime: "09:00", endTime: "10:00", category: "deep_work" });
    setShowAddForm(false);
  };

  const scheduleAsBlock = useCallback((title: string, start?: string, end?: string) => {
    const s = start || "09:00";
    const e = end || minutesToTime(timeToMinutes(s) + 60);
    setNewBlock({ title, startTime: s, endTime: e, category: "deep_work" });
    setShowAddForm(true);
  }, []);

  // Add event + time block together so both panel and timeline stay in sync
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    const title = newEventTitle.trim();
    const start = newEventStart;
    const end = newEventEnd;
    if (!confirmOverlap(start, end)) return;
    await Promise.all([
      addEvent({
        title,
        startTime: `${selectedDate}T${start}:00`,
        endTime: `${selectedDate}T${end}:00`,
        allDay: false,
        color: "#3b82f6",
      }),
      addBlock({
        date: selectedDate,
        startTime: start,
        endTime: end,
        title,
        category: "meeting" as TimeBlockCategory,
        color: CATEGORY_CONFIG.meeting.color,
      }),
    ]);
    setNewEventTitle("");
    setNewEventStart("09:00");
    setNewEventEnd("10:00");
    setAddingEvent(false);
  };

  const handleEditTodo = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setTodoEditOpen(true);
  }, []);

  const handleAddBrainItem = () => {
    if (!newIdeaText.trim()) return;
    const item: BrainItem = { id: uid(), text: newIdeaText.trim(), notes: "", category: "other", duration: 30 };
    const updated = [...brainItems, item];
    setBrainItems(updated);
    saveBrainItems(selectedDate, updated);
    setNewIdeaText("");
  };

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="flex h-full">
      {/* Left: Timeline */}
      <div className={cn("flex flex-col flex-1 min-w-0", panelOpen && "md:border-r md:border-slate-200 md:dark:border-slate-700")}>
        {/* Date navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <h2 className="font-semibold text-slate-900 dark:text-white min-w-[140px] text-center">
              {format(parseISO(selectedDate), "MMM d (EEE)", { locale: enUS })}
            </h2>
            <button
              onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isToday(parseISO(selectedDate)) && (
              <button
                onClick={goToday}
                className="text-xs px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {t("common.today")}
              </button>
            )}
            <button
              onClick={() => setShowStats(!showStats)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300"
              title="Statistics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300"
              title={t("timebox.panel")}
            >
              {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto">
          {Object.entries(
            categoryDurations
          ).map(([cat, mins]) => {
            const config = CATEGORY_CONFIG[cat as TimeBlockCategory];
            return (
              <span key={cat} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {Math.floor((mins as number) / 60)}h{(mins as number) % 60 > 0 ? `${(mins as number) % 60}m` : ""}
                </span>
              </span>
            );
          })}
          {sortedBlocks.length === 0 && (
            <span className="text-xs text-slate-400">{t("timebox.addTimeBlocks")}</span>
          )}
        </div>

        {showStats && <TimeStats selectedDate={selectedDate} onClose={() => setShowStats(false)} />}

        {/* Timeline */}
        <div ref={timelineRef} className="flex-1 overflow-y-auto relative">
          <div
            className="relative"
            style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
            onMouseDown={(e) => {
              if (e.target !== e.currentTarget) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const minutes = Math.round((y / HOUR_HEIGHT) * 60 / 15) * 15 + START_HOUR * 60;
              setDragStart(minutes);
              setDragEnd(minutes);
            }}
            onMouseMove={(e) => {
              if (dragStart === null) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const minutes = Math.round((y / HOUR_HEIGHT) * 60 / 15) * 15 + START_HOUR * 60;
              setDragEnd(minutes);
            }}
            onMouseUp={() => {
              if (dragStart !== null && dragEnd !== null && Math.abs(dragEnd - dragStart) >= 15) {
                const s = Math.min(dragStart, dragEnd);
                const e = Math.max(dragStart, dragEnd);
                setNewBlock({ ...newBlock, startTime: minutesToTime(s), endTime: minutesToTime(e) });
                setShowAddForm(true);
              }
              setDragStart(null);
              setDragEnd(null);
            }}
          >
            {/* Drag preview */}
            {dragStart !== null && dragEnd !== null && (
              <div
                className="absolute left-14 right-2 bg-blue-500/20 border-2 border-blue-500/40 border-dashed rounded-lg pointer-events-none z-10"
                style={{
                  top: ((Math.min(dragStart, dragEnd) - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                  height: (Math.abs(dragEnd - dragStart) / 60) * HOUR_HEIGHT,
                }}
              />
            )}

            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/50"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 left-2 text-xs text-slate-400 dark:text-slate-500 w-10">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {/* Current time indicator */}
            {showCurrentTime && (
              <div
                className="absolute left-12 right-2 z-20 flex items-center pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            )}

            {/* Time blocks */}
            {sortedBlocks.map((block) => (
              <TimeBlockItem
                key={block.id}
                block={block}
                onToggleCompleted={handleToggleCompleted}
                onDeleteBlock={handleDeleteBlock}
              />
            ))}

            {/* Calendar events (shown as dashed blocks if no matching time block) */}
            {timelineEvents.map((ev) => (
              <TimelineEventItem
                key={`ev-${ev.id}`}
                ev={ev}
                onSchedule={scheduleAsBlock}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Daily Plan Panel */}
      {panelOpen && (
        <div className="hidden md:flex flex-col w-72 lg:w-80 flex-shrink-0 bg-white dark:bg-slate-800/50 overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              {t("timebox.panel")}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {format(parseISO(selectedDate), "yyyy.MM.dd (EEE)", { locale: enUS })}
              {" · "}{dayEvents.length} {t("timebox.events")}, {dayTodos.length} {t("timebox.todos")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Events Section ── */}
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {t("timebox.events")} ({dayEvents.length})
                </h4>
                <button
                  onClick={() => { setAddingEvent(true);  }}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                </button>
              </div>

              {/* Quick add event form */}
              {addingEvent && (
                <form onSubmit={handleAddEvent} className="mb-2 space-y-1.5 p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg">
                  <input
                    type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder={t("timebox.eventTitle")}
                    className="w-full text-xs bg-white dark:bg-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <input type="time" value={newEventStart} onChange={(e) => setNewEventStart(e.target.value)}
                      className="flex-1 text-xs bg-white dark:bg-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white outline-none" />
                    <input type="time" value={newEventEnd} onChange={(e) => setNewEventEnd(e.target.value)}
                      className="flex-1 text-xs bg-white dark:bg-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white outline-none" />
                  </div>
                  <div className="flex gap-1.5">
                    <button type="submit" className="flex-1 text-xs py-1 bg-blue-600 text-white rounded hover:bg-blue-500">{t("common.add")}</button>
                    <button type="button" onClick={() => setAddingEvent(false)} className="flex-1 text-xs py-1 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded">{t("common.cancel")}</button>
                  </div>
                </form>
              )}

              {dayEvents.length === 0 && !addingEvent && (
                <p className="text-xs text-slate-400 text-center py-3">{t("timebox.noEvents")}</p>
              )}
              {dayEvents.map((ev) => (
                <PanelEventItem
                  key={ev.id}
                  ev={ev}
                  onSchedule={scheduleAsBlock}
                  onDelete={(id) => { deleteEvent(id); }}
                />
              ))}
            </div>

            <div className="mx-3 border-t border-slate-100 dark:border-slate-700/50" />

            {/* ── Todos Section ── */}
            <div className="px-3 pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {t("timebox.todos")} ({dayTodos.length})
                </h4>
                <button
                  onClick={() => setTodoAddOpen(true)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400 hover:text-amber-500" />
                </button>
              </div>

              {dayTodos.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">{t("timebox.noTodos")}</p>
              )}
              {dayTodos.map((td) => (
                <PanelTodoItem
                  key={td.id}
                  td={td}
                  onToggle={toggleTodo}
                  onSchedule={(title) => scheduleAsBlock(title)}
                  onDelete={deleteTodo}
                  onEdit={handleEditTodo}
                />
              ))}
            </div>

            <div className="mx-3 border-t border-slate-100 dark:border-slate-700/50" />

            {/* ── Brain Dump Section ── */}
            <div className="px-3 pt-3 pb-3">
              <button
                onClick={() => setBrainOpen(!brainOpen)}
                className="flex items-center gap-1.5 mb-2 w-full"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", !brainOpen && "-rotate-90")} />
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  🧠 Brain Dump ({brainItems.length})
                </h4>
              </button>

              {brainOpen && (
                <>
                  {brainItems.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3">No ideas yet</p>
                  )}
                  {brainItems.map((item) => {
                    const catConfig = CATEGORY_CONFIG[item.category];
                    return (
                      <div key={item.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-purple-50/30 dark:hover:bg-slate-700/40 rounded-lg transition-colors">
                        <span className="text-sm shrink-0">{catConfig.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{item.text}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                          {item.duration}m
                        </span>
                        <button
                          onClick={() => scheduleAsBlock(item.text, undefined, minutesToTime(timeToMinutes("09:00") + item.duration))}
                          title="Schedule as block"
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors opacity-0 group-hover:opacity-100 max-md:opacity-100"
                        >
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex gap-1.5 mt-2">
                    <input
                      type="text"
                      value={newIdeaText}
                      onChange={(e) => setNewIdeaText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddBrainItem(); }}
                      placeholder="Quick idea..."
                      className="flex-1 text-xs bg-slate-50 dark:bg-slate-700/40 rounded px-2 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleAddBrainItem}
                      className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile: Bottom sheet panel */}
      {panelOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40 max-h-[50vh] bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              {t("timebox.panel")}
              <span className="text-[11px] font-normal text-slate-400">
                {dayEvents.length} {t("timebox.events")}, {dayTodos.length} {t("timebox.todos")}
              </span>
            </h3>
            <button onClick={() => setPanelOpen(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-1 py-2">
            {/* Events */}
            {dayEvents.map((ev) => (
              <PanelEventItem key={ev.id} ev={ev} onSchedule={scheduleAsBlock} onDelete={deleteEvent} />
            ))}
            {dayEvents.length === 0 && <p className="text-xs text-slate-400 text-center py-2">{t("timebox.noEvents")}</p>}

            <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700/50" />

            {/* Todos */}
            {dayTodos.map((td) => (
              <PanelTodoItem key={td.id} td={td} onToggle={toggleTodo} onSchedule={(title) => scheduleAsBlock(title)} onDelete={deleteTodo} onEdit={handleEditTodo} />
            ))}
            {dayTodos.length === 0 && <p className="text-xs text-slate-400 text-center py-2">{t("timebox.noTodos")}</p>}
          </div>
        </div>
      )}

      {/* Todo Add Modal */}
      <CalendarTodoAddModal
        open={todoAddOpen}
        initialDate={selectedDate}
        onClose={() => setTodoAddOpen(false)}
        onAdd={async (values) => {
          const ok = await addTodo(values.title, values.priority, values.dueDate, values.category, values.status, values.projectId ?? null, values.memo ?? null);
          if (!ok) throw new Error("add failed");
          showToast("success", t("calendar.todoCreated"));
        }}
      />

      {/* Todo Edit Modal */}
      <CalendarTodoEditModal
        open={todoEditOpen}
        todo={editingTodo}
        onClose={() => { setTodoEditOpen(false); setEditingTodo(null); }}
        onSave={async (id, values) => {
          await updateTodo(id, {
            title: values.title,
            category: values.category,
            dueDate: values.dueDate,
            priority: values.priority,
            status: values.status,
            projectId: values.projectId ?? null,
            memo: values.memo ?? null,
          });
          showToast("success", t("calendar.todoUpdated"));
        }}
      />

      {/* Add form modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddForm(false)}>
          <form
            onSubmit={handleAdd}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-xl space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {format(parseISO(selectedDate), "MMM d", { locale: enUS })} — {t("timebox.addBlock")}
            </h3>
            <input
              type="text"
              value={newBlock.title}
              onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              placeholder={t("timebox.blockTitle")}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {/* Category selector */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">{t("calendar.category")}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.entries(CATEGORY_CONFIG) as [TimeBlockCategory, typeof CATEGORY_CONFIG[TimeBlockCategory]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewBlock({ ...newBlock, category: key })}
                      className={cn(
                        "text-xs py-1.5 px-1 rounded-lg border-2 transition-colors text-center",
                        newBlock.category === key
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-transparent bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700",
                      )}
                    >
                      <span className="block text-base">{config.icon}</span>
                      <span className="text-slate-600 dark:text-slate-400">{config.label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.start")}</label>
                <input
                  type="time"
                  value={newBlock.startTime}
                  onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.end")}</label>
                <input
                  type="time"
                  value={newBlock.endTime}
                  onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                {t("common.add")}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
