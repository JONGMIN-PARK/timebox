import { useMemo } from "react";
import type { CalendarEvent, Todo } from "@timebox/shared";
import { useTimeBlockStore } from "@/stores/timeblockStore";
import { useDDayStore } from "@/stores/ddayStore";
import { useI18n } from "@/lib/useI18n";

interface TodaySummaryProps {
  events: CalendarEvent[];
  todos: Todo[];
}

/** Parse "HH:mm" and return minutes since midnight */
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function TodaySummary({ events, todos }: TodaySummaryProps) {
  const { t } = useI18n();
  const blocks = useTimeBlockStore((s) => s.blocks);
  const ddays = useDDayStore((s) => s.ddays);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Events — next upcoming
  const nextEvent = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.startTime) >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;
  }, [events]);

  // Todos due today
  const todoDueToday = useMemo(
    () => todos.filter((td) => td.dueDate?.slice(0, 10) === todayStr),
    [todos, todayStr],
  );
  const activeTodosCount = todoDueToday.filter((td) => !td.completed).length;
  const completedTodosCount = todoDueToday.filter((td) => td.completed).length;

  // Time blocks summary
  const totalScheduledHours = useMemo(() => {
    return blocks.reduce((sum, b) => {
      const dur = (timeToMin(b.endTime) - timeToMin(b.startTime)) / 60;
      return sum + Math.max(0, dur);
    }, 0);
  }, [blocks]);

  // D-Day items within 3 days
  const upcomingDDays = useMemo(() => {
    return ddays.filter((d) => {
      const days = d.daysLeft ?? Math.ceil(
        (new Date(d.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return days >= 0 && days <= 3;
    });
  }, [ddays]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 h-[72px] overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 h-full items-center">
        {/* Column 1: Events */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {t("calendar.todaySummary.events")}
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {events.length}
          </p>
          {nextEvent && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight">
              {formatTime(nextEvent.startTime)} {nextEvent.title}
            </p>
          )}
        </div>

        {/* Column 2: Todos */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {t("calendar.todaySummary.todos")}
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {activeTodosCount}
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">
              / {completedTodosCount} {t("calendar.todaySummary.done")}
            </span>
          </p>
        </div>

        {/* Column 3: Time blocks */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {t("calendar.todaySummary.timeBlocks")}
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {blocks.length}
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">
              {totalScheduledHours.toFixed(1)}h
            </span>
          </p>
        </div>

        {/* Column 4: D-Day */}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {t("calendar.todaySummary.dday")}
          </p>
          {upcomingDDays.length > 0 ? (
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight truncate">
              {upcomingDDays.length}
              <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1 truncate">
                {upcomingDDays[0].title}
              </span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
              {t("calendar.todaySummary.noDDay")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
