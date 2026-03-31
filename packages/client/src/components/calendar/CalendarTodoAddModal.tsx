import { useEffect, useState } from "react";
import { X, CalendarDays, Clock, Circle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { TodoCategoryPicker } from "@/components/todo/TodoCategoryPicker";
import { ProjectPicker } from "@/components/project/ProjectPicker";
import type { TodoStatus } from "@timebox/shared";

export interface CalendarTodoAddValues {
  title: string;
  category: string;
  dueDate: string;
  priority: string;
  status: TodoStatus;
  projectId?: number | null;
  memo?: string | null;
}

interface CalendarTodoAddModalProps {
  open: boolean;
  /** yyyy-MM-dd from selected calendar day */
  initialDate: string;
  onClose: () => void;
  onAdd: (values: CalendarTodoAddValues) => Promise<void>;
}

export default function CalendarTodoAddModal({ open, initialDate, onClose, onAdd }: CalendarTodoAddModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [dueDateOnly, setDueDateOnly] = useState(initialDate);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [status, setStatus] = useState<TodoStatus>("active");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("personal");
      setDueDateOnly(initialDate || new Date().toISOString().slice(0, 10));
      setDueTime("");
      setPriority("medium");
      setStatus("active");
      setProjectId(null);
      setMemo("");
      setSubmitting(false);
    }
  }, [open, initialDate]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const buildDueDate = (): string => {
    if (!dueDateOnly) return new Date().toISOString().slice(0, 10);
    if (dueTime) return `${dueDateOnly}T${dueTime}`;
    return dueDateOnly;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAdd({
        title: title.trim(),
        category,
        dueDate: buildDueDate(),
        priority,
        status,
        projectId,
        memo: memo.trim() || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("calendar.addTodo")}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t("calendar.todoTitle")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("todo.addPlaceholder")}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t("calendar.category")}</label>
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 bg-slate-50/80 dark:bg-slate-700/30 inline-flex">
            <TodoCategoryPicker value={category} onChange={setCategory} />
          </div>
        </div>

        <ProjectPicker value={projectId} onChange={setProjectId} />

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {t("todo.setDate")}
            </label>
            <input
              type="date"
              value={dueDateOnly}
              onChange={(e) => setDueDateOnly(e.target.value)}
              className="text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t("calendar.dueTime")}
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">{t("scheduler.priority")}</label>
          <div className="flex flex-wrap gap-1.5">
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "text-xs py-1.5 px-3 rounded-lg border transition-colors",
                  priority === p
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium"
                    : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                )}
              >
                {t(`todo.priority.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">{t("calendar.todoFormStatus")}</label>
          <div className="flex flex-wrap gap-1.5">
            {([
              { value: "active" as const, icon: Circle, label: t("todo.active") },
              { value: "waiting" as const, icon: Clock, label: t("todo.waiting") },
              { value: "completed" as const, icon: CheckCircle2, label: t("todo.done") },
            ]).map(({ value: v, icon: Icon, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatus(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border transition-colors",
                  status === v
                    ? v === "waiting"
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 font-medium"
                      : v === "completed"
                        ? "border-green-500 bg-green-50 dark:bg-green-500/15 text-green-800 dark:text-green-200 font-medium"
                        : "border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200 font-medium"
                    : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">{t("calendar.memo")}</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t("calendar.memoPlaceholder")}
            rows={5}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
          >
            {t("common.add")}
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
