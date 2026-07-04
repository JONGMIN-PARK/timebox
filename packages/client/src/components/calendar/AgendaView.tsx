import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryInfo } from "@/lib/categories";
import { useI18n } from "@/lib/useI18n";
import { eventTimeLabel } from "@/lib/eventFormat";
import type { CalendarEvent, Todo } from "./calendarTypes";

interface AgendaViewProps {
  days: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  todosByDate: Map<string, Todo[]>;
  onEventClick?: (ev: CalendarEvent) => void;
  onToggleTodo?: (id: number) => void;
  onEditTodo?: (td: Todo) => void;
}

// Google-Calendar-style agenda (schedule) view: a flat chronological list
// of every day in range that has events or todos, grouped by date.
export default function AgendaView({
  days,
  eventsByDate,
  todosByDate,
  onEventClick,
  onToggleTodo,
  onEditTodo,
}: AgendaViewProps) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    return days
      .map((day) => {
        const key = format(day, "yyyy-MM-dd");
        return { day, events: eventsByDate.get(key) || [], todos: todosByDate.get(key) || [] };
      })
      .filter((r) => r.events.length > 0 || r.todos.length > 0);
  }, [days, eventsByDate, todosByDate]);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
        <CalendarDays className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
        <p className="text-sm">{t("calendar.noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px)+8px)] sm:pb-4">
      {rows.map(({ day, events, todos }) => {
        const dow = day.getDay();
        const today = isToday(day);
        return (
          <div key={format(day, "yyyy-MM-dd")} className="flex gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/40">
            {/* Date column */}
            <div className="w-12 shrink-0 flex flex-col items-center">
              <span className={cn("text-[10px] font-medium",
                dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-400")}>
                {format(day, "EEE", { locale: enUS })}
              </span>
              <span className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full text-sm mt-0.5",
                today ? "bg-blue-600 text-white font-bold" : "text-slate-700 dark:text-slate-200 font-semibold",
              )}>
                {format(day, "d")}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5">{format(day, "MMM", { locale: enUS })}</span>
            </div>
            {/* Items column */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {events.map((ev) => (
                <button
                  key={`e-${ev.id}`}
                  onClick={() => onEventClick?.(ev)}
                  className="w-full flex items-center gap-2 text-left rounded-lg px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                  <span className="text-sm text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">{ev.title}</span>
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{eventTimeLabel(ev, t("calendar.allDay"))}</span>
                </button>
              ))}
              {todos.map((td) => (
                <div key={`t-${td.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <button
                    onClick={() => onToggleTodo?.(td.id)}
                    className={cn("w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center",
                      td.completed ? "bg-green-500 border-green-500" : "border-slate-300 dark:border-slate-500")}
                    aria-label="toggle"
                  >
                    {td.completed && <span className="text-white text-[9px] leading-none">✓</span>}
                  </button>
                  <span className="shrink-0 text-xs leading-none select-none" aria-hidden>{getCategoryInfo(td.category).icon}</span>
                  <button
                    onClick={() => onEditTodo?.(td)}
                    className={cn("text-sm truncate flex-1 min-w-0 text-left",
                      td.completed ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200")}
                  >
                    {td.title}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
