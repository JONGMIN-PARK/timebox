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
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import TodoDetailModal from "@/components/todo/TodoDetailModal";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import type { ViewMode, HoverTooltipItem, CalendarEvent, Todo } from "./calendarTypes";
import { HOUR_HEIGHT, START_HOUR } from "./calendarTypes";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";

export default function CalendarView() {
  const { events, fetchEvents, addEvent, deleteEvent, updateEvent } = useEventStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo, updateTodo } = useTodoStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", startTime: "09:00", endTime: "10:00", categoryId: 0 });
  const [recurrence, setRecurrence] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoverDateKey, setHoverDateKey] = useState<string | null>(null);
  const { t } = useI18n();

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
    if (editingEventId) {
      await updateEvent(editingEventId, {
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || undefined,
        startTime: `${dateStr}T${newEvent.startTime}:00`,
        endTime: `${dateStr}T${newEvent.endTime}:00`,
        categoryId: newEvent.categoryId || undefined,
        color: cat?.color || "#3b82f6",
      });
    } else {
      await addEvent({
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || undefined,
        startTime: `${dateStr}T${newEvent.startTime}:00`,
        endTime: `${dateStr}T${newEvent.endTime}:00`,
        allDay: false,
        categoryId: newEvent.categoryId || undefined,
        recurrenceRule: recurrence || undefined,
        color: cat?.color || "#3b82f6",
      });
    }
    setNewEvent({ title: "", description: "", startTime: "09:00", endTime: "10:00", categoryId: 0 });
    setRecurrence("");
    setEditingEventId(null);
    setShowAddModal(false);
    const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setNewEvent({
      title: ev.title,
      description: ev.description || "",
      startTime: ev.startTime.slice(11, 16),
      endTime: ev.endTime.slice(11, 16),
      categoryId: ev.categoryId || 0,
    });
    setShowAddModal(true);
  };

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const handleEditTodo = (td: Todo) => {
    setEditingTodo(td);
  };

  const getHoverItems = (dateKey: string): HoverTooltipItem[] => {
    const dayEvents = eventsByDate.get(dateKey) || [];
    const dayTodos = todosByDate.get(dateKey) || [];
    const items: HoverTooltipItem[] = [];

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

  const handleDayHover = (_e: React.MouseEvent, dateKey: string) => {
    const items = getHoverItems(dateKey);
    if (items.length > 0) {
      setHoverDateKey(dateKey);
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
            {t("common.today")}
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
              {{ month: t("calendar.month"), week: t("calendar.week"), day: t("calendar.day") }[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* === MONTH VIEW === */}
      {viewMode === "month" && (
        <MonthView
          days={days}
          currentDate={currentDate}
          selectedDate={selectedDate}
          eventsByDate={eventsByDate}
          todosByDate={todosByDate}
          selectedDateEvents={selectedDateEvents}
          selectedDateTodos={selectedDateTodos}
          onSelectDate={setSelectedDate}
          onDoubleClickDate={(day) => { setSelectedDate(day); setViewMode("day"); setCurrentDate(day); }}
          hoverDateKey={hoverDateKey}
          getHoverItems={getHoverItems}
          onDayHover={handleDayHover}
          onDayLeave={() => setHoverDateKey(null)}
          onShowAddModal={() => { setEditingEventId(null); setNewEvent({ title: "", description: "", startTime: "09:00", endTime: "10:00", categoryId: 0 }); setShowAddModal(true); }}
          onDeleteEvent={deleteEvent}
          onEditEvent={handleEditEvent}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          onEditTodo={handleEditTodo}
          onLongPressDate={(date, type) => {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            if (type === "event") {
              setSelectedDate(date);
              setShowAddModal(true);
            } else if (type === "todo") {
              const title = prompt("할일 제목:");
              if (title?.trim()) {
                addTodo(title.trim(), "medium", dateStr, "personal");
              }
            } else if (type === "reminder") {
              const title = prompt("리마인더 제목:");
              if (title?.trim()) {
                addTodo(title.trim(), "low", dateStr, "personal");
              }
            }
          }}
        />
      )}

      {/* === WEEK VIEW === */}
      {viewMode === "week" && (
        <WeekView
          days={days}
          eventsByDate={eventsByDate}
          todosByDate={todosByDate}
          onDayClick={(day) => { setViewMode("day"); setCurrentDate(day); }}
          onCellClick={(day) => { setSelectedDate(day); setShowAddModal(true); }}
          onDeleteEvent={deleteEvent}
        />
      )}

      {/* === DAY VIEW === */}
      {viewMode === "day" && (
        <DayView
          currentDate={currentDate}
          events={events}
          eventsByDate={eventsByDate}
          todosByDate={todosByDate}
          currentTimeTop={currentTimeTop}
          currentMinutes={currentMinutes}
          timelineRef={timelineRef}
          onAddEvent={() => { setSelectedDate(currentDate); setShowAddModal(true); }}
          onDeleteEvent={deleteEvent}
        />
      )}

      {/* Add event modal */}
      {showAddModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:bg-black/50" role="dialog" aria-modal="true" onClick={() => { setShowAddModal(false); setEditingEventId(null); }}>
          <form
            onSubmit={handleAddEvent}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm sm:mx-4 bg-white dark:bg-slate-800 sm:rounded-xl shadow-xl flex flex-col sm:max-h-[85vh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
          >
            {/* Header - mobile close */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2 sm:hidden flex-shrink-0">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {format(selectedDate, "MMM d", { locale: enUS })} {editingEventId ? t("calendar.editEvent") || "Edit Event" : t("calendar.addEvent")}
              </h3>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingEventId(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-2 space-y-4">
              <h3 className="font-semibold text-slate-900 dark:text-white hidden sm:block">
                {format(selectedDate, "MMM d", { locale: enUS })} {editingEventId ? t("calendar.editEvent") || "Edit Event" : t("calendar.addEvent")}
              </h3>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder={t("calendar.eventTitle")}
                className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.description") || "Description"}</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder={t("calendar.descriptionPlaceholder") || "Add event details..."}
                  rows={3}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">{t("calendar.category")}</label>
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
                  <label className="text-xs text-slate-500 mb-1 block">{t("calendar.start")}</label>
                  <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">{t("calendar.end")}</label>
                  <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.recurrence") || "반복"}</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full text-xs bg-slate-100/80 dark:bg-slate-700/50 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
                >
                  <option value="">반복 없음</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                </select>
              </div>
            </div>
            {/* Fixed footer buttons */}
            <div className="flex-shrink-0 flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">{editingEventId ? t("common.save") || "Save" : t("common.add")}</button>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingEventId(null); }} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">{t("common.cancel")}</button>
            </div>
          </form>
        </div>
      )}

      {editingTodo && (
        <TodoDetailModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={async (id, updates) => {
            await updateTodo(id, updates);
            setEditingTodo(null);
            const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
            const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
            fetchTodos();
          }}
        />
      )}
    </div>
  );
}
