import { useEffect, useState } from "react";
import { Sparkles, X, CalendarDays, CheckSquare, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { showToast } from "@/components/ui/Toast";

interface Parsed {
  kind: "event" | "todo";
  title: string;
  date: string | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  priority: "high" | "medium" | "low";
  description: string | null;
}

export interface NLEventValues {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  description: string | null;
}
export interface NLTodoValues {
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  memo: string | null;
}

/**
 * Natural-language quick add: the user types a phrase ("내일 3시 팀 회의"),
 * the AI parses it into a structured event/to-do that the user reviews and
 * tweaks before creating.
 */
export default function NLQuickAddModal({
  open,
  onClose,
  onCreateEvent,
  onCreateTodo,
}: {
  open: boolean;
  onClose: () => void;
  onCreateEvent: (v: NLEventValues) => Promise<boolean>;
  onCreateTodo: (v: NLTodoValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<Parsed | null>(null);

  useEffect(() => {
    if (!open) {
      setText("");
      setP(null);
      setParsing(false);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const parse = async () => {
    if (!text.trim() || parsing) return;
    setParsing(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const now = format(new Date(), "HH:mm");
    const res = await api.post<Parsed>("/ai/parse", { text: text.trim(), today, now });
    setParsing(false);
    if (res.success && res.data) {
      const d = res.data;
      setP({
        ...d,
        date: d.date || today,
        startTime: d.startTime || "09:00",
        endTime: d.endTime || "10:00",
      });
    } else {
      showToast("error", res.error || t("ai.parseFailed"));
    }
  };

  const create = async () => {
    if (!p || saving) return;
    setSaving(true);
    let ok = false;
    if (p.kind === "event") {
      ok = await onCreateEvent({
        title: p.title,
        date: p.date || format(new Date(), "yyyy-MM-dd"),
        startTime: p.allDay ? "00:00" : p.startTime || "09:00",
        endTime: p.allDay ? "23:59" : p.endTime || "10:00",
        allDay: p.allDay,
        description: p.description,
      });
    } else {
      ok = await onCreateTodo({
        title: p.title,
        dueDate: p.date || format(new Date(), "yyyy-MM-dd"),
        priority: p.priority,
        memo: p.description,
      });
    }
    setSaving(false);
    if (ok) onClose();
  };

  const set = (patch: Partial<Parsed>) => setP((cur) => (cur ? { ...cur, ...patch } : cur));

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[88dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-500" /> {t("ai.quickAddTitle")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) parse(); }}
            rows={2}
            placeholder={t("ai.quickAddPlaceholder")}
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
          />
          <button
            onClick={parse}
            disabled={!text.trim() || parsing}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium"
          >
            <Wand2 className="w-4 h-4" /> {parsing ? t("ai.parsing") : t("ai.parse")}
          </button>

          {p && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
              {/* kind toggle */}
              <div className="flex gap-1.5">
                {([
                  { k: "event" as const, icon: CalendarDays, label: t("ai.kindEvent") },
                  { k: "todo" as const, icon: CheckSquare, label: t("ai.kindTodo") },
                ]).map(({ k, icon: Icon, label }) => (
                  <button
                    key={k}
                    onClick={() => set({ kind: k })}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border transition-colors",
                      p.kind === k
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 font-medium"
                        : "border-slate-200 dark:border-slate-600 text-slate-500",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              <input
                value={p.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder={t("ai.titlePlaceholder")}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40"
              />

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={p.date || ""}
                  onChange={(e) => set({ date: e.target.value })}
                  className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                {p.kind === "event" && !p.allDay && (
                  <span className="flex items-center gap-1">
                    <input
                      type="time"
                      value={p.startTime || "09:00"}
                      onChange={(e) => set({ startTime: e.target.value })}
                      className="text-sm px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                    <span className="text-slate-400 text-xs">–</span>
                    <input
                      type="time"
                      value={p.endTime || "10:00"}
                      onChange={(e) => set({ endTime: e.target.value })}
                      className="text-sm px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </span>
                )}
                {p.kind === "event" && (
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" checked={p.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
                    {t("ai.allDay")}
                  </label>
                )}
              </div>

              {p.kind === "todo" && (
                <div className="flex gap-1.5">
                  {(["high", "medium", "low"] as const).map((pr) => (
                    <button
                      key={pr}
                      onClick={() => set({ priority: pr })}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                        p.priority === pr
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium"
                          : "border-slate-200 dark:border-slate-600 text-slate-500",
                      )}
                    >
                      {t(`todo.priority.${pr}`)}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={create}
                disabled={!p.title.trim() || saving}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium"
              >
                {saving ? t("common.loading") : t("ai.create")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
