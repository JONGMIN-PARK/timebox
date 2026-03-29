import { useState } from "react";
import { Trash2, ArrowRightLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ProjectMember } from "@/stores/projectStore";

interface TaskDetailActionsProps {
  projectId: number;
  taskId: number;
  members: ProjectMember[];
  assigneeId: number | null;
  readOnly?: boolean;
  hasChanges: boolean;
  titleValid: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void;
}

export default function TaskDetailActions({
  projectId,
  taskId,
  members,
  assigneeId,
  readOnly,
  hasChanges,
  titleValid,
  saving,
  onSave,
  onClose,
  onDelete,
}: TaskDetailActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState<number | "">("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferSending, setTransferSending] = useState(false);
  const [transferResult, setTransferResult] = useState<"sent" | "error" | null>(null);

  const transferableMembers = members.filter((m) => m.userId !== assigneeId);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  };

  const handleTransfer = async () => {
    if (!transferToUserId) return;
    setTransferSending(true);
    setTransferResult(null);
    try {
      const res = await api.post(`/projects/${projectId}/tasks/${taskId}/transfer`, {
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

  return (
    <>
      {/* Transfer section */}
      {!readOnly && (
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
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        {readOnly ? <div /> : (
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
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && <button
            onClick={onSave}
            disabled={!hasChanges || !titleValid || saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>}
        </div>
      </div>
    </>
  );
}
