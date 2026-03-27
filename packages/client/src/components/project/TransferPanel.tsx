import { useEffect, useState, useCallback } from "react";
import { ArrowRight, Check, X, MessageSquare, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TransferTask {
  id: number;
  title: string;
  status: string;
}

interface TransferFromUser {
  id: number;
  username: string;
  displayName: string | null;
}

interface Transfer {
  id: number;
  taskId: number;
  projectId: number;
  fromUserId: number;
  toUserId: number;
  message: string | null;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  task?: TransferTask;
  fromUser?: TransferFromUser;
}

interface TransferPanelProps {
  projectId: number;
}

export default function TransferPanel({ projectId }: TransferPanelProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [responding, setResponding] = useState<number | null>(null);
  const [fadeOut, setFadeOut] = useState<number | null>(null);

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await api.get<Transfer[]>(`/projects/${projectId}/transfers`);
      if (res.success && res.data) {
        setTransfers(res.data);
      }
    } catch {
      // silent
    }
  }, [projectId]);

  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 30000);
    return () => clearInterval(interval);
  }, [fetchTransfers]);

  const handleAccept = async (transferId: number) => {
    setResponding(transferId);
    try {
      const res = await api.put(`/projects/${projectId}/transfers/${transferId}/accept`, {});
      if (res.success) {
        setFadeOut(transferId);
        setTimeout(() => {
          setTransfers((prev) => prev.filter((t) => t.id !== transferId));
          setFadeOut(null);
        }, 300);
      }
    } catch {
      // silent
    }
    setResponding(null);
  };

  const handleReject = async (transferId: number) => {
    setResponding(transferId);
    try {
      const res = await api.put(`/projects/${projectId}/transfers/${transferId}/reject`, {});
      if (res.success) {
        setFadeOut(transferId);
        setTimeout(() => {
          setTransfers((prev) => prev.filter((t) => t.id !== transferId));
          setFadeOut(null);
        }, 300);
      }
    } catch {
      // silent
    }
    setResponding(null);
  };

  if (transfers.length === 0) return null;

  return (
    <div className="mx-4 mt-3 bg-blue-50/80 dark:bg-blue-500/5 border border-blue-200/60 dark:border-blue-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200/40 dark:border-blue-500/10">
        <Inbox className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {t("transfer.title")}
        </span>
        <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium tabular-nums">
          {transfers.length}
        </span>
      </div>

      {/* Transfer items */}
      <div className="divide-y divide-blue-200/30 dark:divide-blue-500/10">
        {transfers.map((transfer) => {
          const senderName = transfer.fromUser?.displayName || transfer.fromUser?.username || "Unknown";
          const taskTitle = transfer.task?.title || `Task #${transfer.taskId}`;
          const isFading = fadeOut === transfer.id;
          const isResponding = responding === transfer.id;

          return (
            <div
              key={transfer.id}
              className={cn(
                "px-4 py-3 transition-all duration-300",
                isFading && "opacity-0 max-h-0 py-0 overflow-hidden",
              )}
            >
              {/* Sender -> Me */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">{senderName}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{t("transfer.from") === "From" ? "Me" : "나"}</span>
              </div>

              {/* Task title */}
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                {taskTitle}
              </p>

              {/* Optional message */}
              {transfer.message && (
                <div className="flex items-start gap-1.5 mb-2">
                  <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {transfer.message}
                  </p>
                </div>
              )}

              {/* Accept / Reject buttons */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => handleAccept(transfer.id)}
                  disabled={isResponding}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  {t("transfer.accept")}
                </button>
                <button
                  onClick={() => handleReject(transfer.id)}
                  disabled={isResponding}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  {t("transfer.reject")}
                </button>
                <span className="text-[10px] text-slate-400 ml-auto">
                  {new Date(transfer.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
