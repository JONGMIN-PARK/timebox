import { useEffect, useState } from "react";
import { X, Sunrise, Sun, Moon, CalendarDays, CheckCircle2, Bell, Target, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { useAuthStore } from "@/stores/authStore";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface BriefingEvent { id: number; title: string; startTime: string; endTime: string; allDay: boolean; color: string | null; }
interface BriefingTodo { id: number; title: string; priority: string; dueDate: string; overdue: boolean; }
interface BriefingReminder { id: number; title: string; message: string | null; remindAt: string; }
interface BriefingDday { id: number; title: string; targetDate: string; daysLeft: number; }
interface Briefing {
  date: string;
  period: "morning" | "afternoon" | "evening";
  events: BriefingEvent[];
  todos: BriefingTodo[];
  reminders: BriefingReminder[];
  ddays: BriefingDday[];
  timeBlocks: { count: number; totalMinutes: number };
  counts: { events: number; todos: number; overdue: number; reminders: number; ddays: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

const priorityDot = (p: string) =>
  p === "high" ? "bg-red-500" : p === "medium" ? "bg-amber-500" : "bg-slate-400";

export default function BriefingModal({ open, onClose, onNavigate }: Props) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<Briefing>("/briefing/today").then((res) => {
      if (res.success && res.data) setBriefing(res.data);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const period = briefing?.period ?? "morning";
  const PeriodIcon = period === "morning" ? Sunrise : period === "evening" ? Moon : Sun;
  const hello =
    period === "morning" ? t("briefing.morning")
    : period === "evening" ? t("briefing.evening")
    : t("briefing.afternoon");
  const name = user?.displayName || user?.username || "";

  const go = (tab: string) => { onNavigate?.(tab); onClose(); };
  const hm = (iso: string) => iso.slice(11, 16);

  const isEmpty = briefing &&
    briefing.events.length === 0 && briefing.todos.length === 0 &&
    briefing.reminders.length === 0 && briefing.ddays.length === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-overlay p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("briefing.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-scale-in"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md flex-shrink-0">
              <PeriodIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                {name ? `${hello}, ${name}${t("briefing.nameSuffix")}` : hello}
              </h2>
              <p className="text-[11px] text-slate-400">{briefing?.date || ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl btn-ghost flex items-center justify-center flex-shrink-0" aria-label={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && !briefing ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
        ) : briefing ? (
          <div className="p-5 space-y-4">
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              <Stat icon={<CalendarDays className="w-3.5 h-3.5" />} label={t("briefing.events")} value={briefing.counts.events} tone="blue" />
              <Stat
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label={t("briefing.dueTodos")}
                value={briefing.counts.todos}
                sub={briefing.counts.overdue > 0 ? `${t("briefing.overdue")} ${briefing.counts.overdue}` : undefined}
                tone={briefing.counts.overdue > 0 ? "red" : "emerald"}
              />
              <Stat icon={<Bell className="w-3.5 h-3.5" />} label={t("briefing.reminders")} value={briefing.counts.reminders} tone="violet" />
            </div>

            {isEmpty && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <Sun className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t("briefing.empty")}</p>
              </div>
            )}

            {/* Events */}
            {briefing.events.length > 0 && (
              <Section title={t("briefing.eventsSection")} icon={<CalendarDays className="w-3.5 h-3.5" />} onClick={() => go("calendar")}>
                {briefing.events.map((e) => (
                  <li key={e.id} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color || "#3b82f6" }} />
                    <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400 w-14 flex-shrink-0">
                      {e.allDay ? t("briefing.allDay") : hm(e.startTime)}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </li>
                ))}
              </Section>
            )}

            {/* Due todos */}
            {briefing.todos.length > 0 && (
              <Section title={t("briefing.todosSection")} icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => go("todo")}>
                {briefing.todos.map((td) => (
                  <li key={td.id} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(td.priority)}`} />
                    <span className="truncate flex-1">{td.title}</span>
                    {td.overdue && (
                      <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {t("briefing.overdue")}
                      </span>
                    )}
                  </li>
                ))}
              </Section>
            )}

            {/* Reminders */}
            {briefing.reminders.length > 0 && (
              <Section title={t("briefing.remindersSection")} icon={<Bell className="w-3.5 h-3.5" />} onClick={() => go("todo")}>
                {briefing.reminders.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400 w-14 flex-shrink-0">{hm(r.remindAt)}</span>
                    <span className="truncate">{r.title}</span>
                  </li>
                ))}
              </Section>
            )}

            {/* D-Days */}
            {briefing.ddays.length > 0 && (
              <Section title={t("briefing.ddaysSection")} icon={<Target className="w-3.5 h-3.5" />} onClick={() => go("todo")}>
                {briefing.ddays.map((d) => (
                  <li key={d.id} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className={`text-xs font-bold w-14 flex-shrink-0 ${d.daysLeft === 0 ? "text-red-500" : "text-blue-600 dark:text-blue-400"}`}>
                      {d.daysLeft === 0 ? "D-Day" : `D-${d.daysLeft}`}
                    </span>
                    <span className="truncate">{d.title}</span>
                  </li>
                ))}
              </Section>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">{t("briefing.error")}</div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: number; sub?: string; tone: "blue" | "emerald" | "red" | "violet"; }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    violet: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${tones[tone]}`}>
      {icon}
      <span className="tabular-nums font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
      {sub && <span className="opacity-90">· {sub}</span>}
    </div>
  );
}

function Section({ title, icon, onClick, children }: { title: string; icon: React.ReactNode; onClick?: () => void; children: React.ReactNode; }) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
      >
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1">{title}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-500" />
      </button>
      <ul className="px-4 py-3 space-y-2">{children}</ul>
    </div>
  );
}
