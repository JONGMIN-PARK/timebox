import { useState, useEffect } from "react";
import { CalendarDays, CheckCircle, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ProjectTask } from "@/stores/projectTaskStore";
import type { ProjectMember } from "@/stores/projectStore";

interface TaskDetailBodyProps {
  projectId: number;
  task: ProjectTask;
  description: string;
  assigneeId: number | null;
  startDate: string;
  dueDate: string;
  members: ProjectMember[];
  readOnly?: boolean;
  onDescriptionChange: (description: string) => void;
  onAssigneeChange: (assigneeId: number | null) => void;
  onStartDateChange: (startDate: string) => void;
  onDueDateChange: (dueDate: string) => void;
}

export default function TaskDetailBody({
  projectId,
  task,
  description,
  assigneeId,
  startDate,
  dueDate,
  members,
  readOnly,
  onDescriptionChange,
  onAssigneeChange,
  onStartDateChange,
  onDueDateChange,
}: TaskDetailBodyProps) {
  const [addedToTodo, setAddedToTodo] = useState(false);

  // Reactions state
  const [reactions, setReactions] = useState<{id: number; emoji: string; userId: number; userName: string}[]>([]);

  useEffect(() => {
    api.get<any[]>(`/projects/${projectId}/tasks/${task.id}/reactions`).then(res => {
      if (res.success && res.data) setReactions(res.data);
    });
  }, [projectId, task.id]);

  const toggleReaction = async (emoji: string) => {
    await api.post(`/projects/${projectId}/tasks/${task.id}/reactions`, { emoji });
    const res = await api.get<any[]>(`/projects/${projectId}/tasks/${task.id}/reactions`);
    if (res.success && res.data) setReactions(res.data);
  };

  const handleAddToTodo = async () => {
    const res = await api.post("/todos", {
      title: `[${task.status}] ${task.title}`,
      priority: task.priority || "medium",
      category: "work",
      dueDate: task.dueDate || null,
    });
    if (res.success) {
      setAddedToTodo(true);
      setTimeout(() => setAddedToTodo(false), 2000);
    }
  };

  return (
    <>
      {/* Assignee */}
      <div>
        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Assignee</label>
        <select
          value={assigneeId ?? ""}
          onChange={(e) => onAssigneeChange(e.target.value ? Number(e.target.value) : null)}
          disabled={readOnly}
          className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName || m.username || `User #${m.userId}`}
            </option>
          ))}
        </select>
      </div>

      {/* Date range row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            readOnly={readOnly}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            readOnly={readOnly}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          readOnly={readOnly}
          placeholder="Add a description..."
          rows={3}
          className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-y min-h-[60px]"
        />
      </div>

      {/* Add to personal todo */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddToTodo}
          disabled={addedToTodo}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:text-green-500"
        >
          {addedToTodo ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              {t("task.addedToTodo")}
            </>
          ) : (
            <>
              <ListTodo className="w-3.5 h-3.5" />
              {t("task.addToTodo")}
            </>
          )}
        </button>
      </div>

      {/* Reactions */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {["\u{1F44D}", "\u{1F525}", "\u{1F4AA}", "\u26A0\uFE0F", "\u2764\uFE0F", "\u{1F440}", "\u{1F389}", "\u{1F4AC}"].map(emoji => {
            const count = reactions.filter(r => r.emoji === emoji).length;
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors",
                  count > 0
                    ? "border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                )}
                title={reactions.filter(r => r.emoji === emoji).map(r => r.userName).join(", ")}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Meta info */}
      <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
        <span>Created: {new Date(task.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
        <span>Updated: {new Date(task.updatedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
      </div>
    </>
  );
}
