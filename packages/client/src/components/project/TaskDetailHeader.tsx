import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/stores/projectTaskStore";

const STATUS_OPTIONS: { key: TaskStatus; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { key: "high", label: "High", color: "#ef4444" },
  { key: "medium", label: "Medium", color: "#f59e0b" },
  { key: "low", label: "Low", color: "#94a3b8" },
];

interface TaskDetailHeaderProps {
  taskId: number;
  title: string;
  status: TaskStatus;
  priority: string;
  readOnly?: boolean;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: string) => void;
  onClose: () => void;
}

export default function TaskDetailHeader({
  taskId,
  title,
  status,
  priority,
  readOnly,
  onTitleChange,
  onStatusChange,
  onPriorityChange,
  onClose,
}: TaskDetailHeaderProps) {
  return (
    <>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Task #{taskId}</span>
        <button onClick={onClose} aria-label="Close dialog" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        readOnly={readOnly}
        className={cn("w-full text-lg font-semibold bg-transparent text-slate-900 dark:text-white outline-none placeholder-slate-400 rounded-lg px-2 py-1 -mx-2", !readOnly && "focus:ring-2 focus:ring-blue-500/30")}
        placeholder="Task title"
      />

      {/* Status + Priority row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            disabled={readOnly}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Priority</label>
          <div className="flex gap-1.5">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => !readOnly && onPriorityChange(p.key)}
                disabled={readOnly}
                className={cn(
                  "flex-1 text-xs py-2 rounded-lg border-2 transition-colors text-center font-medium",
                  priority === p.key
                    ? "border-current"
                    : "border-transparent bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700",
                )}
                style={priority === p.key ? { color: p.color, borderColor: p.color, backgroundColor: p.color + "18" } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
