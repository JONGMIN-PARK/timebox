import { useState, useEffect } from "react";
import { X, Trash2, CalendarDays, ArrowRightLeft, CheckCircle, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ProjectTask, TaskStatus } from "@/stores/projectTaskStore";
import type { ProjectMember } from "@/stores/projectStore";

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

interface TaskDetailModalProps {
  projectId: number;
  task: ProjectTask;
  members: ProjectMember[];
  onClose: () => void;
  onUpdate: (taskId: number, data: Partial<ProjectTask>) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
}

export default function TaskDetailModal({ projectId, task, members, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState<number | null>(task.assigneeId);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [startDate, setStartDate] = useState(task.startDate || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState<number | "">("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferSending, setTransferSending] = useState(false);
  const [transferResult, setTransferResult] = useState<"sent" | "error" | null>(null);

  const hasChanges =
    title !== task.title ||
    description !== (task.description || "") ||
    status !== task.status ||
    priority !== task.priority ||
    assigneeId !== task.assigneeId ||
    startDate !== (task.startDate || "") ||
    dueDate !== (task.dueDate || "");

  const handleSave = async () => {
    if (!title.trim() || !hasChanges) return;
    setSaving(true);
    await onUpdate(task.id, {
      title: title.trim(),
      description: description || null,
      status,
      priority,
      assigneeId,
      startDate: startDate || null,
      dueDate: dueDate || null,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(task.id);
    onClose();
  };

  const handleTransfer = async () => {
    if (!transferToUserId) return;
    setTransferSending(true);
    setTransferResult(null);
    try {
      const res = await api.post(`/projects/${projectId}/tasks/${task.id}/transfer`, {
        toUserId: transferToUserId,
        message: transferMessage.trim() || undefined,
      });
      if (res.success) {
        setTransferResult("sent");
        setTransferToUserId("");
        setTransferMessage("");
        setTimeout(() => setShowTransfer(false), 1500);
      } else {
        setTransferResult("error");
      }
    } catch {
      setTransferResult("error");
    }
    setTransferSending(false);
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

  // Members eligible for transfer (exclude current assignee)
  const transferableMembers = members.filter((m) => m.userId !== task.assigneeId);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Task details">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Task #{task.id}</span>
          <button onClick={onClose} aria-label="Close dialog" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-semibold bg-transparent text-slate-900 dark:text-white outline-none placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 rounded-lg px-2 py-1 -mx-2"
            placeholder="Task title"
          />

          {/* Status + Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
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
                    onClick={() => setPriority(p.key)}
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

          {/* Assignee */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Assignee</label>
            <select
              value={assigneeId ?? ""}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
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
                onChange={(e) => setStartDate(e.target.value)}
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
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
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
                const myReaction = reactions.some(r => r.emoji === emoji && r.userId === (task.assigneeId || 0));
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

          {/* Transfer section */}
          <div>
            {!showTransfer ? (
              <button
                onClick={() => setShowTransfer(true)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t("transfer.request")}
              </button>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t("transfer.title")}
                  </span>
                  <button
                    onClick={() => { setShowTransfer(false); setTransferResult(null); }}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </div>

                <select
                  value={transferToUserId}
                  onChange={(e) => setTransferToUserId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full text-sm bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 border border-slate-200 dark:border-slate-600"
                >
                  <option value="">{t("transfer.selectMember")}</option>
                  {transferableMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName || m.username || `User #${m.userId}`}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  placeholder={t("transfer.message")}
                  className="w-full text-sm bg-white dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 border border-slate-200 dark:border-slate-600"
                  onKeyDown={(e) => { if (e.key === "Enter") handleTransfer(); }}
                />

                {transferResult === "sent" && (
                  <p className="text-xs text-green-600 dark:text-green-400">{t("transfer.sent")}</p>
                )}
                {transferResult === "error" && (
                  <p className="text-xs text-red-500">Failed to send transfer request</p>
                )}

                <button
                  onClick={handleTransfer}
                  disabled={!transferToUserId || transferSending}
                  className="w-full text-xs font-medium py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {transferSending ? "..." : t("transfer.request")}
                </button>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
            <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleDelete}
            className={cn(
              "flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors",
              confirmDelete
                ? "bg-red-500 text-white hover:bg-red-600"
                : "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || !title.trim() || saving}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
