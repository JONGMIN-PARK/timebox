import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { projectApi } from "@/lib/apiService";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";

type CalendarPayload = {
  myEvents: Array<{
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
    color?: string | null;
  }>;
  othersBusy: Array<{ id: number; title: string; startTime: string; endTime: string; allDay: boolean; userId: number }>;
  projectTasks: Array<{ id: number; title: string; dueDate: string | null; status: string; priority: string }>;
};

export default function ProjectScheduleCalendar({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const [month, setMonth] = useState(() => new Date());
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const start = format(startOfMonth(month), "yyyy-MM-dd'T'00:00:00");
    const end = format(endOfMonth(month), "yyyy-MM-dd'T'23:59:59");
    projectApi.getCalendar(projectId, start, end).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setData({
          myEvents: res.data.myEvents,
          othersBusy: res.data.othersBusy,
          projectTasks: res.data.projectTasks,
        });
      } else {
        setData({ myEvents: [], othersBusy: [], projectTasks: [] });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, month]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/60 dark:border-slate-700/40 shrink-0">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {format(month, "MMMM yyyy", { locale: enUS })}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && data && (
          <>
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {t("project.calendarMyEvents")}
              </h3>
              {data.myEvents.length === 0 ? (
                <p className="text-sm text-slate-400">{t("common.noData")}</p>
              ) : (
                <ul className="space-y-2">
                  {data.myEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex gap-2 text-sm rounded-lg border border-slate-200/60 dark:border-slate-700/50 px-3 py-2 bg-white/80 dark:bg-slate-800/50"
                    >
                      <span className="w-1 rounded-full shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {ev.startTime.slice(0, 16).replace("T", " ")} – {ev.endTime.slice(11, 16)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {t("project.calendarTeamBusy")}
              </h3>
              <p className="text-[11px] text-slate-400 mb-2">{t("project.calendarTeamBusyHint")}</p>
              {data.othersBusy.length === 0 ? (
                <p className="text-sm text-slate-400">{t("common.noData")}</p>
              ) : (
                <ul className="space-y-2">
                  {data.othersBusy.map((ev) => (
                    <li
                      key={ev.id}
                      className="text-sm rounded-lg border border-slate-200/60 dark:border-slate-700/50 px-3 py-2 bg-slate-50/80 dark:bg-slate-800/30"
                    >
                      <p className="font-medium text-slate-600 dark:text-slate-300">{ev.title}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {ev.startTime.slice(0, 16).replace("T", " ")} – {ev.endTime.slice(11, 16)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {t("project.calendarTaskDue")}
              </h3>
              {data.projectTasks.length === 0 ? (
                <p className="text-sm text-slate-400">{t("common.noData")}</p>
              ) : (
                <ul className="space-y-2">
                  {data.projectTasks.map((task) => (
                    <li
                      key={task.id}
                      className={cn(
                        "text-sm rounded-lg border px-3 py-2",
                        task.priority === "high"
                          ? "border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10"
                          : "border-slate-200/60 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/50",
                      )}
                    >
                      <p className="font-medium text-slate-900 dark:text-white">{task.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {t("project.due")}: {task.dueDate} · {task.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
