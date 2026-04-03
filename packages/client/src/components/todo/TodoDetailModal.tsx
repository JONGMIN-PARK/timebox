import { useState, useEffect, useRef } from "react";
import { X, Calendar, Clock, Circle, Clock3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryInfo, TODO_CATEGORIES, type TodoCategoryDef } from "@/stores/todoStore";
import type { Todo, TodoStatus } from "@timebox/shared";
import { useI18n } from "@/lib/useI18n";

interface TodoDetailModalProps {
  todo: Todo;
  onClose: () => void;
  onSave: (id: number, updates: Partial<Todo>) => Promise<void>;
}

const PRIORITY_OPTIONS = [
  { key: "high", label: "High", color: "#ef4444" },
  { key: "medium", label: "Medium", color: "#f59e0b" },
  { key: "low", label: "Low", color: "#94a3b8" },
];

const STATUS_OPTIONS: { key: TodoStatus; label: string; icon: typeof Circle }[] = [
  { key: "active", label: "Active", icon: Circle },
  { key: "waiting", label: "Waiting", icon: Clock3 },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

export default function TodoDetailModal({ todo, onClose, onSave }: TodoDetailModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(todo.title);
  const [category, setCategory] = useState(todo.category);
  const [dueDate, setDueDate] = useState((todo.dueDate || "").slice(0, 10));
  const [dueTime, setDueTime] = useState(
    todo.dueDate && todo.dueDate.includes("T") ? todo.dueDate.slice(11, 16) : ""
  );
  const [priority, setPriority] = useState(todo.priority);
  const [status, setStatus] = useState<TodoStatus>(todo.status || "active");
  const [memo, setMemo] = useState(todo.memo || "");
  const [saving, setSaving] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const catInfo = getCategoryInfo(category);

  const hasChanges =
    title !== todo.title ||
    category !== todo.category ||
    priority !== todo.priority ||
    status !== (todo.status || "active") ||
    memo !== (todo.memo || "") ||
    dueDate !== (todo.dueDate || "").slice(0, 10) ||
    dueTime !== (todo.dueDate && todo.dueDate.includes("T") ? todo.dueDate.slice(11, 16) : "");

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const newDueDate = dueDate
      ? dueTime
        ? `${dueDate}T${dueTime}`
        : dueDate
      : null;
    const completed = status === "done";
    await onSave(todo.id, {
      title: title.trim(),
      category,
      priority,
      status,
      memo: memo || null,
      dueDate: newDueDate,
      completed,
      progress: completed ? 100 : todo.progress,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:mx-4 bg-white dark:bg-slate-800 sm:rounded-xl shadow-xl flex flex-col sm:max-h-[85vh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("todo.editTodo") || "Edit Todo"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              {t("todo.todoTitle") || "Todo title"}
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              {t("todo.category") || "Category"}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCatPickerOpen(!catPickerOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
              >
                <span>{catInfo.icon}</span>
                <span>
                  {catInfo.parentLabel
                    ? `${catInfo.parentLabel} > ${catInfo.label}`
                    : catInfo.label}
                </span>
              </button>
              {catPickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setCatPickerOpen(false)}
                  />
                  <div className="absolute z-30 left-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 max-h-52 overflow-y-auto">
                    {TODO_CATEGORIES.map((cat: TodoCategoryDef) => (
                      <div key={cat.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (cat.children) {
                              setExpandedCat(
                                expandedCat === cat.id ? null : cat.id
                              );
                            } else {
                              setCategory(cat.id);
                              setCatPickerOpen(false);
                            }
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50",
                            category === cat.id &&
                              "bg-blue-50 dark:bg-blue-900/20"
                          )}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                        {cat.children && expandedCat === cat.id && (
                          <div className="pl-6">
                            {cat.children.map((child) => (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => {
                                  setCategory(child.id);
                                  setCatPickerOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50",
                                  category === child.id &&
                                    "bg-blue-50 dark:bg-blue-900/20 font-medium"
                                )}
                              >
                                {child.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Date + Time row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {t("todo.setDate") || "Set date"}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t("todo.time") || "Time (optional)"}
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">
              {t("todo.priority") || "Priority"}
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key)}
                  className={cn(
                    "px-4 py-1.5 text-xs rounded-lg border-2 transition-colors font-medium",
                    priority === p.key
                      ? "border-current"
                      : "border-transparent bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  style={
                    priority === p.key
                      ? {
                          color: p.color,
                          borderColor: p.color,
                          backgroundColor: p.color + "15",
                        }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">
              {t("todo.status") || "Status"}
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = status === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border-2 transition-colors font-medium",
                      isActive
                        ? s.key === "done"
                          ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20"
                          : s.key === "waiting"
                          ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                          : "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "border-transparent bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              {t("todo.memo") || "Memo"}
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("todo.memoPlaceholder") || "Add details or notes..."}
              rows={4}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>
        </div>

        {/* Fixed footer buttons */}
        <div className="flex-shrink-0 flex gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || !hasChanges || saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "..." : t("common.save") || "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg"
          >
            {t("common.cancel") || "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
