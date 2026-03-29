import { useState, useEffect, useRef } from "react";
import { ClipboardList, Send, Pencil, Trash } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/dateUtils";

interface WorkLog {
  id: number;
  userId: number;
  userName: string;
  content: string;
  createdAt: string;
}

interface TaskDetailCommentsProps {
  projectId: number;
  taskId: number;
}

export default function TaskDetailComments({ projectId, taskId }: TaskDetailCommentsProps) {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [newLogContent, setNewLogContent] = useState("");
  const [addingLog, setAddingLog] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingLogContent, setEditingLogContent] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const refreshLogs = async () => {
    const res = await api.get<any[]>(`/projects/${projectId}/tasks/${taskId}/worklogs`);
    if (res.success && res.data) setWorkLogs(res.data);
  };

  useEffect(() => { refreshLogs(); }, [projectId, taskId]);

  const handleAddWorkLog = async () => {
    if (!newLogContent.trim() || addingLog) return;
    setAddingLog(true);
    const res = await api.post(`/projects/${projectId}/tasks/${taskId}/worklogs`, { content: newLogContent.trim() });
    if (res.success) {
      await refreshLogs();
      setNewLogContent("");
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    setAddingLog(false);
  };

  const handleEditWorkLog = async (logId: number) => {
    if (!editingLogContent.trim()) return;
    const res = await api.put(`/projects/${projectId}/tasks/${taskId}/worklogs/${logId}`, { content: editingLogContent.trim() });
    if (res.success) {
      await refreshLogs();
      setEditingLogId(null);
      setEditingLogContent("");
    }
  };

  const handleDeleteWorkLog = async (logId: number) => {
    const res = await api.delete(`/projects/${projectId}/tasks/${taskId}/worklogs/${logId}`);
    if (res.success) await refreshLogs();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Work Log ({workLogs.length})</span>
      </div>

      {workLogs.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
          {workLogs.map((log) => (
            <div key={log.id} className="text-xs group/log">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">{log.userName}</span>
                <span className="text-slate-400">{fmtDateTime(log.createdAt)}</span>
                <div className="ml-auto flex gap-1 opacity-0 group-hover/log:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingLogId(log.id); setEditingLogContent(log.content); }}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-blue-500"
                    title="Edit"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteWorkLog(log.id)}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {editingLogId === log.id ? (
                <div className="flex gap-1.5 mt-1">
                  <textarea
                    value={editingLogContent}
                    onChange={(e) => setEditingLogContent(e.target.value)}
                    rows={2}
                    className="flex-1 text-xs bg-white dark:bg-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40 resize-none border border-slate-200 dark:border-slate-600"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEditWorkLog(log.id); if (e.key === "Escape") { setEditingLogId(null); setEditingLogContent(""); } }}
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => handleEditWorkLog(log.id)} className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-500">Save</button>
                    <button onClick={() => { setEditingLogId(null); setEditingLogContent(""); }} className="px-2 py-1 text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap pl-0.5 mt-0.5">{log.content}</p>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={newLogContent}
          onChange={(e) => setNewLogContent(e.target.value)}
          placeholder="Add work progress update..."
          rows={2}
          className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddWorkLog(); }}
        />
        <button
          onClick={handleAddWorkLog}
          disabled={!newLogContent.trim() || addingLog}
          className="self-end p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Add log (Ctrl+Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
