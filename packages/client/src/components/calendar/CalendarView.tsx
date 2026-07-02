import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useEventStore } from "@/stores/eventStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useTodoStore } from "@/stores/todoStore";
import { useTimeBlockStore } from "@/stores/timeblockStore";
import { useDDayStore } from "@/stores/ddayStore";
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
  isSameDay,
  parseISO,
  isValid,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Repeat, Search, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { useSocketEvent } from "@/lib/SocketProvider";
import { usePageVisible } from "@/lib/useVisibility";
import type { ViewMode, HoverTooltipItem, CalendarEvent, Todo } from "./calendarTypes";
import { HOUR_HEIGHT, START_HOUR } from "./calendarTypes";
import { showToast } from "@/components/ui/Toast";
import CalendarTodoAddModal from "./CalendarTodoAddModal";
import CalendarTodoEditModal from "./CalendarTodoEditModal";
import type { Todo as AppTodo } from "@timebox/shared";
import { ProjectPicker } from "@/components/project/ProjectPicker";
import { useProjectStore } from "@/stores/projectStore";
import { sortTodosForDisplay } from "@/lib/todoSort";
import { getCategoryInfo } from "@/lib/categories";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import CalendarSearchPanel from "./CalendarSearchPanel";
import RecipientPickerModal from "@/components/common/RecipientPickerModal";
import NLQuickAddModal, { type NLEventValues, type NLTodoValues } from "./NLQuickAddModal";

export default function CalendarView() {
  const { events, fetchEvents, addEvent, deleteEvent, updateEvent } = useEventStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo, updateTodo } = useTodoStore();
  const fetchBlocks = useTimeBlockStore((s) => s.fetchBlocks);
  const fetchDDays = useDDayStore((s) => s.fetchDDays);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", startDate: "", endDate: "", startTime: "09:00", endTime: "10:00", allDay: false, categoryId: 0, projectId: null as number | null, recurrenceRule: "",
  });
  const { projects, fetchProjects } = useProjectStore();
  const projectNameById = useMemo(
    () => Object.fromEntries(projects.filter((p) => !p.archived).map((p) => [p.id, p.name])) as Record<number, string>,
    [projects],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  const [projectFilter, setProjectFilter] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoverDateKey, setHoverDateKey] = useState<string | null>(null);
  const [todoAddModalOpen, setTodoAddModalOpen] = useState(false);
  const [todoAddModalDate, setTodoAddModalDate] = useState("");
  const [todoEditModalOpen, setTodoEditModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<AppTodo | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwardingEventId, setForwardingEventId] = useState<number | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpYear, setJumpYear] = useState(new Date().getFullYear());
  const { t } = useI18n();
  const pageVisible = usePageVisible();

  // Auto-navigate to today when page becomes visible and date has changed
  useEffect(() => {
    if (pageVisible) {
      const today = new Date();
      if (!isSameDay(currentDate, today)) {
        setCurrentDate(today);
      }
      if (!selectedDate || !isSameDay(selectedDate, today)) {
        setSelectedDate(today);
      }
      fetchDDays();
      fetchBlocks(format(today, "yyyy-MM-dd"));
    }
  }, [pageVisible]);

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
    fetchDDays();
    fetchBlocks(format(new Date(), "yyyy-MM-dd"));
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
    const filteredEvents = projectFilter
      ? events.filter(ev => ev.projectId === projectFilter)
      : events;
    const map = new Map<string, typeof events>();
    filteredEvents.forEach((ev) => {
      const startKey = ev.startTime.slice(0, 10);
      let endKey = ev.endTime ? ev.endTime.slice(0, 10) : startKey;
      if (endKey < startKey) endKey = startKey;
      if (endKey === startKey) {
        const existing = map.get(startKey) || [];
        existing.push(ev);
        map.set(startKey, existing);
        return;
      }
      // Multi-day event: list it on every day it spans (inclusive), capped for safety.
      let d = parseISO(startKey);
      const end = parseISO(endKey);
      for (let guard = 0; d <= end && guard < 400; guard++) {
        const key = format(d, "yyyy-MM-dd");
        const existing = map.get(key) || [];
        existing.push(ev);
        map.set(key, existing);
        d = addDays(d, 1);
      }
    });
    return map;
  }, [events, projectFilter]);

  const todosByDate = useMemo(() => {
    const map = new Map<string, typeof todos>();
    todos.forEach((t) => {
      if (t.deletedAt) return;
      if (t.dueDate) {
        const dateKey = t.dueDate.slice(0, 10); // normalize to yyyy-MM-dd
        const existing = map.get(dateKey) || [];
        existing.push(t);
        map.set(dateKey, existing);
      }
    });
    map.forEach((arr, key) => {
      map.set(key, sortTodosForDisplay(arr));
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

  const openJump = () => {
    setJumpYear((selectedDate ?? currentDate).getFullYear());
    setJumpOpen(true);
  };

  // Jump to a specific month (keeps the current view mode).
  const jumpToMonth = (year: number, monthIndex: number) => {
    const d = new Date(year, monthIndex, 1);
    setCurrentDate(d);
    if (viewMode === "day") setSelectedDate(d);
    setJumpOpen(false);
  };

  // Jump to an exact date and select it.
  const jumpToDate = (value: string) => {
    if (!value) return;
    const d = parseISO(value);
    if (!isValid(d)) return;
    setCurrentDate(d);
    setSelectedDate(d);
    setJumpOpen(false);
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
    const fallbackDate = format(selectedDate, "yyyy-MM-dd");
    const sDate = newEvent.startDate || fallbackDate;
    const eDate = newEvent.endDate || sDate;
    const sTime = newEvent.allDay ? "00:00" : newEvent.startTime;
    const eTime = newEvent.allDay ? "23:59" : newEvent.endTime;
    const startTime = `${sDate}T${sTime}:00`;
    const endTime = `${eDate}T${eTime}:00`;
    // Guard against an end that lands before the start (spanning date ranges).
    if (parseISO(endTime) < parseISO(startTime)) {
      showToast("error", t("calendar.endBeforeStart"));
      return;
    }
    const cat = categories.find((c) => c.id === newEvent.categoryId);
    try {
      if (editingEventId) {
        await updateEvent(editingEventId, {
          title: newEvent.title.trim(),
          description: newEvent.description.trim() || null,
          startTime,
          endTime,
          allDay: newEvent.allDay,
          categoryId: newEvent.categoryId || undefined,
          color: cat?.color || "#3b82f6",
          projectId: newEvent.projectId,
          recurrenceRule: newEvent.recurrenceRule || undefined,
        });
        showToast("success", t("calendar.eventCreated"));
      } else {
        await addEvent({
          title: newEvent.title.trim(),
          description: newEvent.description.trim() || undefined,
          startTime,
          endTime,
          allDay: newEvent.allDay,
          categoryId: newEvent.categoryId || undefined,
          recurrenceRule: newEvent.recurrenceRule || undefined,
          color: cat?.color || "#3b82f6",
          projectId: newEvent.projectId,
        });
        showToast("success", t("calendar.eventCreated"));
      }
    } catch {
      showToast("error", t("calendar.createFailed"));
    }
    setNewEvent({ title: "", description: "", startDate: "", endDate: "", startTime: "09:00", endTime: "10:00", allDay: false, categoryId: 0, projectId: null, recurrenceRule: "" });
    setRecurrence("");
    setEditingEventId(null);
    setShowAddModal(false);
    const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  };

  // On a fresh (non-edit) open, clear any leftover range/all-day so the modal
  // defaults to the selected day. Editing sets these fields explicitly.
  useEffect(() => {
    if (showAddModal && editingEventId == null) {
      setNewEvent((prev) => (prev.startDate || prev.endDate || prev.allDay ? { ...prev, startDate: "", endDate: "", allDay: false } : prev));
    }
  }, [showAddModal, editingEventId]);

  // Live-refresh the calendar when someone forwards an event/to-do to me.
  useSocketEvent(
    "events:updated",
    useCallback(() => {
      const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
      const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
      fetchEvents(start, end);
    }, [rangeStart, rangeEnd, fetchEvents]),
  );
  useSocketEvent("todos:updated", useCallback(() => fetchTodos(), [fetchTodos]));

  const forwardEvent = async (toUserId: number): Promise<boolean> => {
    if (forwardingEventId == null) return false;
    const res = await api.post(`/events/${forwardingEventId}/forward`, { toUserId });
    if (res.success) {
      showToast("success", t("calendar.forwarded"));
      return true;
    }
    showToast("error", res.error || t("calendar.forwardFailed"));
    return false;
  };

  const quickCreateEvent = async (v: NLEventValues): Promise<boolean> => {
    try {
      await addEvent({
        title: v.title,
        description: v.description || undefined,
        startTime: `${v.date}T${v.startTime}:00`,
        endTime: `${v.date}T${v.endTime}:00`,
        allDay: v.allDay,
        color: "#3b82f6",
      });
      showToast("success", t("calendar.eventCreated"));
      const start = format(rangeStart, "yyyy-MM-dd'T'00:00:00");
      const end = format(rangeEnd, "yyyy-MM-dd'T'23:59:59");
      fetchEvents(start, end);
      return true;
    } catch {
      showToast("error", t("calendar.createFailed"));
      return false;
    }
  };

  const quickCreateTodo = async (v: NLTodoValues): Promise<boolean> => {
    const ok = await addTodo(v.title, v.priority, v.dueDate, "personal", "active", null, v.memo);
    if (ok) showToast("success", t("calendar.todoCreated"));
    else showToast("error", t("calendar.createFailed"));
    return !!ok;
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      await deleteEvent(id);
      showToast("success", t("calendar.eventDeleted"));
    } catch {
      showToast("error", t("calendar.createFailed"));
    }
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    // Anchor the edit to the event's own date so saving keeps it there
    // (the add/edit form derives the date from selectedDate).
    const evDate = parseISO(ev.startTime);
    if (isValid(evDate)) setSelectedDate(evDate);
    setNewEvent({
      title: ev.title,
      description: ev.description || "",
      startDate: ev.startTime.slice(0, 10),
      endDate: ev.endTime.slice(0, 10),
      startTime: ev.startTime.slice(11, 16),
      endTime: ev.endTime.slice(11, 16),
      allDay: !!ev.allDay,
      categoryId: ev.categoryId || 0,
      projectId: ev.projectId ?? null,
      recurrenceRule: ev.recurrenceRule || "",
    });
    setShowAddModal(true);
  };

  const handleEditTodo = (td: Todo) => {
    const latest = todos.find((t) => t.id === td.id) ?? (td as AppTodo);
    setEditingTodo(latest);
    setTodoEditModalOpen(true);
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
        categoryIcon: getCategoryInfo(t.category).icon,
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
      {/* Navigation header — stacks into two rows on mobile, single row on desktop */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Previous period">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="relative flex-1 sm:flex-none min-w-0 sm:min-w-[120px]">
            <button
              type="button"
              onClick={openJump}
              className="w-full font-semibold text-slate-900 dark:text-white text-center whitespace-nowrap px-1 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-haspopup="dialog"
              aria-expanded={jumpOpen}
              title={t("calendar.jumpTo")}
            >
              {headerTitle()}
            </button>
            {jumpOpen && (
              <div
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
                role="dialog"
                aria-modal="true"
                onClick={() => setJumpOpen(false)}
              >
                <div
                  className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Year stepper */}
                  <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={() => setJumpYear((y) => y - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Previous year">
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums text-lg">{jumpYear}</span>
                    <button type="button" onClick={() => setJumpYear((y) => y + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Next year">
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  {/* Month grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => {
                      const isCurrent = currentDate.getFullYear() === jumpYear && currentDate.getMonth() === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => jumpToMonth(jumpYear, i)}
                          className={cn(
                            "text-xs py-2 rounded-lg transition-colors",
                            isCurrent
                              ? "bg-blue-600 text-white font-semibold"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
                          )}
                        >
                          {format(new Date(2000, i, 1), "MMM", { locale: enUS })}
                        </button>
                      );
                    })}
                  </div>
                  {/* Exact date */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">{t("calendar.jumpToDate")}</label>
                    <input
                      type="date"
                      value={format(selectedDate ?? currentDate, "yyyy-MM-dd")}
                      onChange={(e) => jumpToDate(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Next period">
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => { const today = new Date(); setCurrentDate(today); setSelectedDate(today); }}
            className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 shrink-0"
          >
            {t("common.today")}
          </button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/60"
              aria-label={t("ai.quickAddTitle")}
              title={t("ai.quickAddTitle")}
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              aria-label={t("calendar.searchTitle")}
              title={t("calendar.searchTitle")}
            >
              <Search className="w-4 h-4" />
            </button>
            <select
              value={projectFilter ?? ""}
              onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : null)}
              className="hidden sm:block text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-none outline-none cursor-pointer max-w-[140px]"
            >
              <option value="">{t("calendar.allProjects")}</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
          onShowAddModal={() => {
            setEditingEventId(null);
            setNewEvent({ title: "", description: "", startDate: "", endDate: "", startTime: "09:00", endTime: "10:00", allDay: false, categoryId: 0, projectId: null, recurrenceRule: "" });
            setShowAddModal(true);
          }}
          onDeleteEvent={handleDeleteEvent}
          onEditEvent={handleEditEvent}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          onEditTodo={handleEditTodo}
          projectNameById={projectNameById}
          onLongPressDate={(date, type) => {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            if (type === "event") {
              setSelectedDate(date);
              setShowAddModal(true);
            } else if (type === "todo") {
              setTodoAddModalDate(dateStr);
              setTodoAddModalOpen(true);
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
          onDeleteEvent={handleDeleteEvent}
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
          onDeleteEvent={handleDeleteEvent}
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
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0 border-b border-slate-100 dark:border-slate-700/50 sm:border-0 sm:px-5 sm:pt-5 sm:pb-0">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {format(selectedDate, "MMM d", { locale: enUS })} {editingEventId ? t("calendar.editEvent") || "Edit Event" : t("calendar.addEvent")}
              </h3>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingEventId(null); }} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 sm:hidden" aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-4">
            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder={t("calendar.eventTitle")}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t("calendar.eventMemo")}</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder={t("calendar.eventMemoPlaceholder")}
                rows={5}
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
            {(() => {
              const fallback = format(selectedDate, "yyyy-MM-dd");
              const sDate = newEvent.startDate || fallback;
              const eDate = newEvent.endDate || sDate;
              return (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">{t("calendar.startDate")}</label>
                      <input
                        type="date"
                        value={sDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewEvent({ ...newEvent, startDate: v, endDate: eDate < v ? v : eDate });
                        }}
                        className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">{t("calendar.endDate")}</label>
                      <input
                        type="date"
                        value={eDate}
                        min={sDate}
                        onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                        className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEvent.allDay}
                      onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    {t("calendar.allDayEvent")}
                  </label>
                  {!newEvent.allDay && (
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
                  )}
                </div>
              );
            })()}
            <ProjectPicker value={newEvent.projectId} onChange={(pid) => setNewEvent({ ...newEvent, projectId: pid })} />
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5" />
                {t("calendar.recurrence")}
              </label>
              <div className="flex gap-1.5">
                {([
                  { value: "", label: t("calendar.noRepeat") || "None" },
                  { value: "daily", label: t("calendar.daily") },
                  { value: "weekly", label: t("calendar.weekly") },
                  { value: "monthly", label: t("calendar.monthly") },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, recurrenceRule: opt.value })}
                    className={cn(
                      "text-xs py-1.5 px-3 rounded-lg border transition-colors",
                      newEvent.recurrenceRule === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium"
                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            </div>
            <div className="flex-shrink-0 flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
              {editingEventId && (
                <button
                  type="button"
                  onClick={() => setForwardingEventId(editingEventId)}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg flex items-center gap-1"
                  title={t("calendar.forward")}
                >
                  <Send className="w-4 h-4" /> {t("calendar.forward")}
                </button>
              )}
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">{editingEventId ? t("common.save") : t("common.add")}</button>
              <button type="button" onClick={() => { setShowAddModal(false); setEditingEventId(null); }} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">{t("common.cancel")}</button>
            </div>
          </form>
        </div>
      )}

      <CalendarSearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        todos={todos as AppTodo[]}
        projectNameById={projectNameById}
        onEditEvent={handleEditEvent}
        onEditTodo={handleEditTodo}
      />

      <RecipientPickerModal
        open={forwardingEventId != null}
        title={t("calendar.forwardEventTitle")}
        onClose={() => setForwardingEventId(null)}
        onForward={forwardEvent}
      />

      <NLQuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreateEvent={quickCreateEvent}
        onCreateTodo={quickCreateTodo}
      />

      <CalendarTodoAddModal
        open={todoAddModalOpen}
        initialDate={todoAddModalDate}
        onClose={() => setTodoAddModalOpen(false)}
        onAdd={async (values) => {
          const ok = await addTodo(values.title, values.priority, values.dueDate, values.category, values.status, values.projectId ?? null, values.memo ?? null);
          if (!ok) throw new Error("add failed");
          showToast("success", t("calendar.todoCreated"));
        }}
      />

      <CalendarTodoEditModal
        open={todoEditModalOpen}
        todo={editingTodo}
        onClose={() => {
          setTodoEditModalOpen(false);
          setEditingTodo(null);
        }}
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

    </div>
  );
}
