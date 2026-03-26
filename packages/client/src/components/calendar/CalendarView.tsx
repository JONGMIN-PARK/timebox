import { useEffect, useState, useMemo } from "react";
import { useEventStore } from "@/stores/eventStore";
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
  parseISO,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarView() {
  const { events, fetchEvents, addEvent, deleteEvent } = useEventStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", startTime: "09:00", endTime: "10:00" });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    const start = format(calendarStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(calendarEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  }, [currentDate]);

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

  const selectedDateEvents = selectedDate
    ? eventsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    await addEvent({
      title: newEvent.title.trim(),
      startTime: `${dateStr}T${newEvent.startTime}:00`,
      endTime: `${dateStr}T${newEvent.endTime}:00`,
      allDay: false,
    });
    setNewEvent({ title: "", startTime: "09:00", endTime: "10:00" });
    setShowAddModal(false);
    // Refresh
    const start = format(calendarStart, "yyyy-MM-dd'T'00:00:00");
    const end = format(calendarEnd, "yyyy-MM-dd'T'23:59:59");
    fetchEvents(start, end);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="font-semibold text-slate-900 dark:text-white">
          {format(currentDate, "yyyy년 M월", { locale: ko })}
        </h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-medium py-2",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500",
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayOfWeek = day.getDay();

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "relative flex flex-col items-center p-1 border-b border-r border-slate-100 dark:border-slate-700/50 transition-colors",
                !isSameMonth(day, currentDate) && "opacity-30",
                isSelected && "bg-blue-50 dark:bg-blue-900/20",
                !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-700/30",
              )}
            >
              <span
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm",
                  isToday(day) && "bg-blue-600 text-white font-bold",
                  !isToday(day) && dayOfWeek === 0 && "text-red-500",
                  !isToday(day) && dayOfWeek === 6 && "text-blue-500",
                  !isToday(day) && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-slate-700 dark:text-slate-300",
                )}
              >
                {format(day, "d")}
              </span>
              {/* Event dots */}
              <div className="flex gap-0.5 mt-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {format(selectedDate, "M월 d일 (EEE)", { locale: ko })}
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {selectedDateEvents.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400 text-center">일정이 없습니다</p>
            ) : (
              selectedDateEvents.map((ev) => (
                <div key={ev.id} className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="w-1 h-8 rounded-full" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                    <p className="text-xs text-slate-400">
                      {ev.startTime.slice(11, 16)} - {ev.endTime.slice(11, 16)}
                    </p>
                  </div>
                  <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100">
                    <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add event modal */}
      {showAddModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <form
            onSubmit={handleAddEvent}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-xl space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {format(selectedDate, "M월 d일", { locale: ko })} 일정 추가
            </h3>
            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="일정 제목"
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">시작</label>
                <input
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">종료</label>
                <input
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                추가
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
