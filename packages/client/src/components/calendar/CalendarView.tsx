import { useEffect, useState, useMemo, useRef } from "react";
import { useEventStore } from "@/stores/eventStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useTodoStore } from "@/stores/todoStore";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, CheckSquare, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Tooltip component for hover
function HoverTooltip({ items, position }: {
  items: { type: "event" | "todo"; title: string; time?: string; color: string; completed?: boolean }[];
  position: { x: number; y: number };
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-2.5 min-w-[180px] max-w-[260px] pointer-events-none"
      style={{ left: position.x + 12, top: position.y + 12 }}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          {item.type === "event" ? (
            <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: item.color }} />
          ) : (
            <CheckSquare className={cn("w-3 h-3 flex-shrink-0", item.completed ? "text-green-500" : "text-amber-500")} />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs truncate", item.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white")}>
              {item.title}
            </p>
            {item.time && <p className="text-[10px] text-slate-400">{item.time}</p>}
          </div>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
        </div>
      ))}
    </div>
  );
}

export default function CalendarView() {
  const { events, fetchEvents, addEvent, deleteEvent } = useEventStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { todos, fetchTodos } = useTodoStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", startTime: "09:00", endTime: "10:00", categoryId: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ items: any[]; position: { x: number; y: number } } | null>(null);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === "month") {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return { rangeStart: startOfWeek(ms, { weekStartsOn: 0 }), rangeEnd: endOfWeek(me, { weekStartsOn: 0 }) };
    } else if (viewMode === "week") {
      return { rangeStart: startOfWeek(currentDate, { weekStartsOn: 0 }), rangeEnd: endOfWeek(currentDate, { weekStartsOn: 0 }) };
    } else {
      return { rangeStart: currentDate, rangeEnd: currentDate };
    }
  }, [currentDate, viewMode]);

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  );

  useEffect(() => {
    fetchCategories();
    fetchTodos();
  }, []);

  useEffect(() => {
    const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  }, [currentDate, viewMode]);

  useEffect(() => {
    if ((viewMode === "week" || viewMode === "day") && timelineRef.current) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100;
      timelineRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [viewMode]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach((ev) => {
      const dateKey = ev.startTime.slice(0, 10);
      const existing = map.get(dateKey) || [];
      existing.push(ev);
      map.set(dateKey, existing);
    });
    return map;
  }, [events]);

  // Todos by due date
  const todosByDate = useMemo(() => {
    const map = new Map<string, typeof todos>();
    todos.forEach((t) => {
      if (t.dueDate) {
        const existing = map.get(t.dueDate) || [];
        existing.push(t);
        map.set(t.dueDate, existing);
      }
    });
    return map;
  }, [todos]);

  const selectedDateEvents = selectedDate
    ? eventsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const selectedDateTodos = selectedDate
    ? todosByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const navigate = (direction: -1 | 1) => {
    if (viewMode === "month") setCurrentDate(direction === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(direction === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(direction === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const headerTitle = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: enUS });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "M/d")} - ${format(we, "M/d")}`;
    }
    return format(currentDate, "MMM d (EEE)", { locale: enUS });
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const cat = categories.find((c) => c.id === newEvent.categoryId);
    await addEvent({
      title: newEvent.title.trim(),
      startTime: `${dateStr}T${newEvent.startTime}:00`,
      endTime: `${dateStr}T${newEvent.endTime}:00`,
      allDay: false,
      categoryId: newEvent.categoryId || undefined,
      color: cat?.color || "#3b82f6",
    });
    setNewEvent({ title: "", startTime: "09:00", endTime: "10:00", categoryId: 0 });
    setShowAddModal(false);
    const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  };

  // Build hover items for a date
  const getHoverItems = (dateKey: string) => {
    const dayEvents = eventsByDate.get(dateKey) || [];
    const dayTodos = todosByDate.get(dateKey) || [];
    const items: { type: "event" | "todo"; title: string; time?: string; color: string; completed?: boolean }[] = [];

    dayEvents.forEach((ev) => {
      items.push({
        type: "event",
        title: ev.title,
        time: `${ev.startTime.slice(11, 16)} - ${ev.endTime.slice(11, 16)}`,
        color: ev.color || "#3b82f6",
      });
    });

    dayTodos.forEach((t) => {
      items.push({
        type: "todo",
        title: t.title,
        color: t.priority === "high" ? "#ef4444" : t.priority === "medium" ? "#f59e0b" : "#94a3b8",
        completed: t.completed,
      });
    });

    return items;
  };

  const handleDayHover = (e: React.MouseEvent, dateKey: string) => {
    const items = getHoverItems(dateKey);
    if (items.length > 0) {
      setHoverInfo({ items, position: { x: e.clientX, y: e.clientY } });
    }
  };

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="font-semibold text-slate-900 dark:text-white min-w-[120px] text-center">
            {headerTitle()}
          </h2>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 ml-1"
          >
            Today
          </button>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors",
                viewMode === mode
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {{ month: "M", week: "W", day: "D" }[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* === MONTH VIEW === */}
      {viewMode === "month" && (
        <>
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <div key={day} className={cn("text-center text-xs font-medium py-2", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500")}>
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate.get(dateKey) || [];
              const dayTodos = todosByDate.get(dateKey) || [];
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dow = day.getDay();
              const hasItems = dayEvents.length > 0 || dayTodos.length > 0;
              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => { setSelectedDate(day); setViewMode("day"); setCurrentDate(day); }}
                  onMouseEnter={(e) => handleDayHover(e, dateKey)}
                  onMouseMove={(e) => { if (hoverInfo) setHoverInfo({ ...hoverInfo, position: { x: e.clientX, y: e.clientY } }); }}
                  onMouseLeave={() => setHoverInfo(null)}
                  className={cn(
                    "relative flex flex-col items-center p-1 border-b border-r border-slate-100 dark:border-slate-700/50 transition-colors",
                    !isSameMonth(day, currentDate) && "opacity-30",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20",
                    !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-700/30",
                  )}
                >
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm",
                    isToday(day) && "bg-blue-600 text-white font-bold",
                    !isToday(day) && dow === 0 && "text-red-500",
                    !isToday(day) && dow === 6 && "text-blue-500",
                    !isToday(day) && dow !== 0 && dow !== 6 && "text-slate-700 dark:text-slate-300",
                  )}>
                    {format(day, "d")}
                  </span>
                  {/* Dots: events (colored) + todos (amber/green) */}
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[40px]">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div key={`e-${ev.id}`} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                    ))}
                    {dayTodos.slice(0, 2).map((t) => (
                      <div
                        key={`t-${t.id}`}
                        className={cn("w-1.5 h-1.5 rounded-sm", t.completed ? "bg-green-400" : "bg-amber-400")}
                      />
                    ))}
                    {(dayEvents.length + dayTodos.length) > 4 && (
                      <span className="text-[8px] text-slate-400 leading-none">+</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Selected date detail - events + todos */}
          {selectedDate && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {format(selectedDate, "MMM d (EEE)", { locale: enUS })}
                </span>
                <button onClick={() => setShowAddModal(true)} className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {selectedDateEvents.length === 0 && selectedDateTodos.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-slate-400 text-center">No events</p>
                ) : (
                  <>
                    {/* Events */}
                    {selectedDateEvents.map((ev) => (
                      <div key={`ev-${ev.id}`} className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                          <p className="text-xs text-slate-400">{ev.startTime.slice(11, 16)} - {ev.endTime.slice(11, 16)}</p>
                        </div>
                        <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100">
                          <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                    {/* Todos */}
                    {selectedDateTodos.map((t) => (
                      <div key={`td-${t.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className={cn("w-1 h-8 rounded-full", t.completed ? "bg-green-400" : "bg-amber-400")} />
                        <CheckSquare className={cn("w-3.5 h-3.5 flex-shrink-0", t.completed ? "text-green-500" : "text-amber-500")} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm truncate", t.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white")}>
                            {t.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            {t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* === WEEK VIEW === */}
      {viewMode === "week" && (
        <>
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-700">
            <div />
            {days.map((day) => {
              const dow = day.getDay();
              const dateKey = format(day, "yyyy-MM-dd");
              const dayTodos = todosByDate.get(dateKey) || [];
              return (
                <button
                  key={dateKey}
                  onClick={() => { setViewMode("day"); setCurrentDate(day); }}
                  className="flex flex-col items-center py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <span className={cn("text-xs font-medium", dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-500")}>
                    {format(day, "EEE", { locale: enUS })}
                  </span>
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm mt-0.5",
                    isToday(day) && "bg-blue-600 text-white font-bold",
                    !isToday(day) && "text-slate-700 dark:text-slate-300",
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayTodos.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTodos.slice(0, 3).map((t) => (
                        <div key={t.id} className={cn("w-1 h-1 rounded-sm", t.completed ? "bg-green-400" : "bg-amber-400")} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={timelineRef} className="flex-1 overflow-y-auto">
            <div className="relative grid grid-cols-[3rem_repeat(7,1fr)]" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
              {HOURS.map((hour) => (
                <div key={hour} className="absolute left-0 w-12 text-right pr-2" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 6 }}>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{hour.toString().padStart(2, "0")}:00</span>
                </div>
              ))}
              {HOURS.map((hour) => (
                <div key={`line-${hour}`} className="absolute left-12 right-0 border-t border-slate-100 dark:border-slate-700/50" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />
              ))}
              {currentMinutes >= START_HOUR * 60 && (
                <div className="absolute left-12 right-0 z-10 flex items-center pointer-events-none" style={{ top: currentTimeTop }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}
              {days.map((day, colIdx) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDate.get(dateKey) || [];
                return (
                  <div
                    key={dateKey}
                    className="relative border-r border-slate-100 dark:border-slate-700/50"
                    style={{ gridColumn: colIdx + 2 }}
                    onClick={() => { setSelectedDate(day); setShowAddModal(true); }}
                  >
                    {dayEvents.map((ev) => {
                      const startMin = timeToMinutes(ev.startTime.slice(11, 16));
                      const endMin = timeToMinutes(ev.endTime.slice(11, 16));
                      const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);
                      return (
                        <div
                          key={ev.id}
                          className="absolute left-0.5 right-0.5 rounded border-l-3 px-1 py-0.5 overflow-hidden cursor-pointer group"
                          style={{ top, height, borderLeftColor: ev.color || "#3b82f6", backgroundColor: (ev.color || "#3b82f6") + "20" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                          {height >= 36 && <p className="text-[10px] text-slate-400">{ev.startTime.slice(11, 16)}</p>}
                          <button onClick={() => deleteEvent(ev.id)} className="absolute top-0.5 right-0.5 hidden group-hover:flex w-4 h-4 items-center justify-center rounded bg-white/80 dark:bg-slate-800/80">
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* === DAY VIEW === */}
      {viewMode === "day" && (
        <>
          {/* Day header with todos */}
          <div className="border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {events.filter((e) => e.startTime.startsWith(format(currentDate, "yyyy-MM-dd"))).length} events
                {(todosByDate.get(format(currentDate, "yyyy-MM-dd")) || []).length > 0 && (
                  <span className="ml-2">
                    · {(todosByDate.get(format(currentDate, "yyyy-MM-dd")) || []).length} todos
                  </span>
                )}
              </span>
              <button onClick={() => { setSelectedDate(currentDate); setShowAddModal(true); }} className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {/* Todos for this day */}
            {(todosByDate.get(format(currentDate, "yyyy-MM-dd")) || []).length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {(todosByDate.get(format(currentDate, "yyyy-MM-dd")) || []).map((t) => (
                  <span
                    key={t.id}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      t.completed
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 line-through"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {t.title}
                  </span>
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
              {(eventsByDate.get(format(currentDate, "yyyy-MM-dd")) || []).map((ev) => {
                const startMin = timeToMinutes(ev.startTime.slice(11, 16));
                const endMin = timeToMinutes(ev.endTime.slice(11, 16));
                const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);
                return (
                  <div
                    key={ev.id}
                    className="absolute left-14 right-3 rounded-lg border-l-4 px-3 py-1.5 group"
                    style={{ top, height, borderLeftColor: ev.color || "#3b82f6", backgroundColor: (ev.color || "#3b82f6") + "18" }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                        {height >= 40 && <p className="text-xs text-slate-400">{ev.startTime.slice(11, 16)} - {ev.endTime.slice(11, 16)}</p>}
                      </div>
                      <button onClick={() => deleteEvent(ev.id)} className="hidden group-hover:flex w-5 h-5 items-center justify-center">
                        <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Hover tooltip */}
      {hoverInfo && <HoverTooltip items={hoverInfo.items} position={hoverInfo.position} />}

      {/* Add event modal */}
      {showAddModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <form
            onSubmit={handleAddEvent}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-xl space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {format(selectedDate, "MMM d", { locale: enUS })} Add Event
            </h3>
            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="Event title"
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {categories.length > 0 && (
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, categoryId: cat.id })}
                      className={cn(
                        "text-xs py-1 px-2.5 rounded-full border-2 transition-colors",
                        newEvent.categoryId === cat.id
                          ? "border-current font-medium"
                          : "border-transparent bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700",
                      )}
                      style={newEvent.categoryId === cat.id ? { color: cat.color, backgroundColor: cat.color + "15" } : undefined}
                    >
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Start</label>
                <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">End</label>
                <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Add</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
