import React from "react";
import { format, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Todo } from "./calendarTypes";

interface WeekViewProps {
  days: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  todosByDate: Map<string, Todo[]>;
  currentTimeTop: number;
  currentMinutes: number;
  timelineRef: React.RefObject<HTMLDivElement>;
  onDayClick: (day: Date) => void;
  onCellClick: (day: Date) => void;
  onDeleteEvent: (id: number) => void;
}

export default function WeekView({
  days,
  eventsByDate,
  todosByDate,
  onDayClick,
  onCellClick,
  onDeleteEvent,
}: WeekViewProps) {
  return (
    <div className="flex-1 grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 overflow-y-auto">
      {days.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDate.get(dateKey) || [];
        const dayTodos = todosByDate.get(dateKey) || [];
        const dow = day.getDay();

        return (
          <div
            key={dateKey}
            className="bg-white dark:bg-slate-800 flex flex-col min-h-0 cursor-pointer"
            onClick={() => onCellClick(day)}
          >
            {/* Day header */}
            <button
              onClick={(e) => { e.stopPropagation(); onDayClick(day); }}
              className="flex flex-col items-center py-2 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 flex-shrink-0"
            >
              <span className={cn("text-[10px] font-medium",
                dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-slate-500")}>
                {format(day, "EEE", { locale: enUS })}
              </span>
              <span className={cn(
                "w-7 h-7 flex items-center justify-center rounded-full text-sm",
                isToday(day) && "bg-blue-600 text-white font-bold",
                !isToday(day) && "text-slate-700 dark:text-slate-300",
              )}>
                {format(day, "d")}
              </span>
            </button>

            {/* Events & Todos */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {dayEvents.map((ev) => (
                <div
                  key={`e-${ev.id}`}
                  className="group rounded px-1.5 py-1 border-l-[3px] overflow-hidden relative"
                  style={{
                    borderLeftColor: ev.color || "#3b82f6",
                    backgroundColor: (ev.color || "#3b82f6") + "15",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] font-medium text-slate-900 dark:text-white truncate leading-tight">
                    {ev.title}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    {ev.startTime.slice(11, 16)}–{ev.endTime.slice(11, 16)}
                  </p>
                  <button
                    onClick={() => onDeleteEvent(ev.id)}
                    className="absolute top-0.5 right-0.5 hidden group-hover:flex w-4 h-4 items-center justify-center rounded bg-white/80 dark:bg-slate-800/80"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
              {dayTodos.map((t) => (
                <div
                  key={`t-${t.id}`}
                  className="flex items-center gap-1 px-1 py-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-sm flex-shrink-0",
                    t.completed ? "bg-green-400" : "bg-amber-400")} />
                  <span className={cn("text-[10px] truncate leading-tight",
                    t.completed ? "line-through text-slate-400" : "text-slate-600 dark:text-slate-400")}>
                    {t.title}
                  </span>
                </div>
              ))}
              {dayEvents.length === 0 && dayTodos.length === 0 && (
                <p className="text-[9px] text-slate-300 dark:text-slate-600 text-center py-2">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
