import { useState, useRef } from "react";
import { format, isSameMonth, isSameDay, isToday } from "date-fns";
import { enUS } from "date-fns/locale";
import { Plus, X, CheckSquare, Calendar, Pencil, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import type { CalendarEvent, Todo, HoverTooltipItem } from "./calendarTypes";
import HoverTooltip from "./HoverTooltip";

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
  onDeleteEvent: (id: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onToggleTodo?: (id: number) => void;
  onDeleteTodo?: (id: number) => void;
  onEditTodo?: (todo: Todo) => void;
  onLongPressDate?: (date: Date, type: string) => void;
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
  onDeleteEvent,
  onEditEvent,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
  onLongPressDate,
}: MonthViewProps) {
  const { t } = useI18n();
  const [longPressDate, setLongPressDate] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
          <div key={day} className={cn("text-center text-xs font-medium py-2", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500")}>
            {day}
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 overflow-y-auto grid grid-cols-7 auto-rows-[minmax(3.2rem,4.5rem)]">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const dayTodos = todosByDate.get(dateKey) || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dow = day.getDay();
          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onDoubleClickDate(day)}
              onTouchStart={(e) => {
                const target = e.currentTarget;
                touchTimer.current = setTimeout(() => {
                  e.preventDefault();
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
                  <div key={`e-${ev.id}`} className="flex items-center gap-0.5 px-0.5">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                    <p className="text-[10px] leading-tight truncate text-slate-700 dark:text-slate-300">{ev.title}</p>
                  </div>
                ))}
                {dayTodos.slice(0, 3).map((td) => (
                  <div key={`t-${td.id}`} className="flex items-center gap-0.5 px-0.5">
                    <div className={cn("w-1 h-1 rounded-sm shrink-0", td.completed ? "bg-green-400" : "bg-amber-400")} />
                    <p className={cn("text-[10px] leading-tight truncate", td.completed ? "line-through text-slate-400" : "text-slate-600 dark:text-slate-400")}>{td.title}</p>
                  </div>
                ))}
                {(dayEvents.length + dayTodos.length) > 6 && (
                  <span className="text-[9px] text-slate-400 px-0.5">+{dayEvents.length + dayTodos.length - 6} more</span>
                )}
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
              { type: "reminder", icon: "\u23F0", label: t("calendar.addReminder") },
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

      {/* Selected date detail - events + todos */}
      {selectedDate && (
        <div className="flex-1 min-h-[180px] flex flex-col border-t-2 border-blue-500/30 dark:border-blue-400/20 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-750/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {format(selectedDate, "MMM d (EEE)", { locale: enUS })}
              </span>
              {(selectedDateEvents.length + selectedDateTodos.length) > 0 && (
                <span className="text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">
                  {selectedDateEvents.length + selectedDateTodos.length}
                </span>
              )}
            </div>
            <button onClick={onShowAddModal} className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-sm transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {selectedDateEvents.length === 0 && selectedDateTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">{t("calendar.noEvents")}</p>
                <button onClick={onShowAddModal} className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium">
                  + {t("calendar.addEvent")}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {/* Events */}
                {selectedDateEvents.map((ev) => (
                  <div key={`ev-${ev.id}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{ev.startTime.slice(11, 16)} - {ev.endTime.slice(11, 16)}</p>
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
                ))}
                {/* Todos */}
                {selectedDateTodos.map((td) => (
                  <div key={`td-${td.id}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/30 dark:hover:bg-slate-700/40 transition-colors">
                    {onToggleTodo ? (
                      <button onClick={() => onToggleTodo(td.id)} className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", td.completed ? "bg-green-500 border-green-500" : "border-slate-300 dark:border-slate-600 hover:border-amber-400")}>
                        {td.completed && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ) : (
                      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", td.completed ? "bg-green-400" : "bg-amber-400")} />
                    )}
                    <CheckSquare className={cn("w-3.5 h-3.5 flex-shrink-0", td.completed ? "text-green-500" : "text-amber-500")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", td.completed ? "line-through text-slate-400" : "font-medium text-slate-900 dark:text-white")}>
                        {td.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {td.priority === "high" ? "High" : td.priority === "medium" ? "Medium" : "Low"}
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* No date selected - show hint */}
      {!selectedDate && (
        <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-600">
          <p className="text-xs">{t("calendar.selectDateHint") || "Tap a date to see details"}</p>
        </div>
      )}
    </div>
  );
}
