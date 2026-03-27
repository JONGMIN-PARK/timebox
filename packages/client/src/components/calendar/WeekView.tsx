import React from "react";
import { format, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  HOURS,
  timeToMinutes,
} from "./calendarTypes";
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
  currentTimeTop,
  currentMinutes,
  timelineRef,
  onDayClick,
  onCellClick,
  onDeleteEvent,
}: WeekViewProps) {
  return (
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
              onClick={() => onDayClick(day)}
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
                onClick={() => onCellClick(day)}
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
                      <button onClick={() => onDeleteEvent(ev.id)} className="absolute top-0.5 right-0.5 hidden group-hover:flex w-4 h-4 items-center justify-center rounded bg-white/80 dark:bg-slate-800/80">
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
  );
}
