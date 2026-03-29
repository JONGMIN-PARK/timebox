import { useEffect, useState, useCallback, useRef, memo } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { Mail, Send, Trash2, CheckCheck, ArrowLeft, Plus, RotateCcw, CheckSquare, Square } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import EmptyState from "@/components/ui/EmptyState";
import { showToast } from "@/components/ui/Toast";
import { useSocketEvent } from "@/lib/SocketProvider";

interface InboxMessage {
  id: number;
  fromUserId: number;
  toUserId: number;
  fromName?: string;
  toName?: string;
  subject: string;
  content: string;
  type: string;
  relatedProjectId: number | null;
  relatedTaskId: number | null;
  read: boolean;
  createdAt: string;
}

interface UserOption {
  id: number;
  username: string;
  displayName: string | null;
}

type View = "list" | "detail" | "compose";
type Folder = "main" | "trash";

const InboxMessageItem = memo(function InboxMessageItem({
  msg,
  tab,
  selectionMode,
  selected,
  onRowActivate,
  formatDate,
  typeIcon,
}: {
  msg: InboxMessage;
  tab: "inbox" | "sent";
  selectionMode: boolean;
  selected: boolean;
  onRowActivate: (msg: InboxMessage) => void;
  formatDate: (d: string) => string;
  typeIcon: (type: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={() => onRowActivate(msg)}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3",
        !msg.read && tab === "inbox" && !selectionMode && "bg-blue-50/50 dark:bg-blue-500/5",
        selected && "bg-blue-100/60 dark:bg-blue-500/10",
      )}
    >
      {selectionMode && (
        <span className="mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden>
          {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0">{typeIcon(msg.type)}</span>
          <span
            className={cn(
              "text-[13px] flex-1 truncate",
              !msg.read && tab === "inbox" && !selectionMode
                ? "font-semibold text-slate-900 dark:text-white"
                : "text-slate-700 dark:text-slate-300",
            )}
          >
            {msg.subject}
          </span>
          <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400 truncate">
            {tab === "inbox" ? msg.fromName : `\u2192 ${msg.toName}`}
          </span>
          {!msg.read && tab === "inbox" && !selectionMode && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
});

export default function InboxPanel() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [folder, setFolder] = useState<Folder>("main");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [toUserId, setToUserId] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    let endpoint: string;
    if (folder === "trash") {
      endpoint = tab === "inbox" ? "/inbox/trash" : "/inbox/sent/trash";
    } else {
      endpoint = tab === "inbox" ? "/inbox" : "/inbox/sent";
    }
    const res = await api.get<InboxMessage[]>(endpoint);
    if (res.success && res.data) setMessages(res.data);
    setLoading(false);
  }, [tab, folder]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    setFolder("main");
    setSelectedIds([]);
    setSelectionMode(false);
  }, [tab]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectionMode(false);
  }, [folder]);

  const tabRef = useRef(tab);
  tabRef.current = tab;
  const folderRef = useRef(folder);
  folderRef.current = folder;

  useSocketEvent("inbox:update", useCallback(() => fetchMessages(), [fetchMessages]));
  useSocketEvent(
    "inbox:new-message",
    useCallback(() => {
      if (tabRef.current === "inbox" && folderRef.current === "main") fetchMessages();
    }, [fetchMessages]),
  );

  const notifyInboxUpdated = () => window.dispatchEvent(new Event("inbox-updated"));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleOpenMsg = async (msg: InboxMessage) => {
    setSelectedMsg(msg);
    setView("detail");
    if (!msg.read && tab === "inbox" && folder === "main") {
      const res = await api.put(`/inbox/${msg.id}/read`, {});
      if (res.success) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)));
        notifyInboxUpdated();
      }
    }
  };

  const handleRowActivate = (msg: InboxMessage) => {
    if (selectionMode) {
      toggleSelect(msg.id);
      return;
    }
    void handleOpenMsg(msg);
  };

  /** 임시 삭제(휴지통) — 받은/보낸 동일 */
  const handleSoftDelete = async (id: number) => {
    const res = await api.delete(`/inbox/${id}`);
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMsg?.id === id) {
        setView("list");
        setSelectedMsg(null);
      }
      notifyInboxUpdated();
      showToast("success", t("inbox.deleteSuccess"));
    } else {
      showToast("error", t("inbox.deleteFailed"));
    }
  };

  const handleBulkSoftDelete = async () => {
    if (selectedIds.length === 0) return;
    const res = await api.post("/inbox/bulk-trash", { ids: selectedIds });
    if (res.success) {
      showToast("success", t("inbox.deleteSuccess"));
      setSelectedIds([]);
      setSelectionMode(false);
      await fetchMessages();
      notifyInboxUpdated();
    } else {
      showToast("error", t("inbox.deleteFailed"));
    }
  };

  const handleRestore = async (id: number) => {
    const res = await api.post(`/inbox/${id}/restore`, {});
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMsg?.id === id) {
        setView("list");
        setSelectedMsg(null);
      }
      notifyInboxUpdated();
      showToast("success", t("inbox.restoreSuccess"));
    } else {
      showToast("error", t("inbox.restoreFailed"));
    }
  };

  const handlePurge = async (id: number) => {
    if (!window.confirm(t("inbox.purgeConfirm"))) return;
    const res = await api.post(`/inbox/${id}/purge`, {});
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMsg?.id === id) {
        setView("list");
        setSelectedMsg(null);
      }
      notifyInboxUpdated();
      showToast("success", t("inbox.purgeSuccess"));
    } else {
      showToast("error", t("inbox.purgeFailed"));
    }
  };

  const handleBulkPurge = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t("inbox.purgeConfirm"))) return;
    const res = await api.post("/inbox/bulk-purge", { ids: selectedIds });
    if (res.success) {
      showToast("success", t("inbox.purgeSuccess"));
      setSelectedIds([]);
      setSelectionMode(false);
      await fetchMessages();
      notifyInboxUpdated();
    } else {
      showToast("error", t("inbox.purgeFailed"));
    }
  };

  const handleMarkAllRead = async () => {
    await api.put("/inbox/read-all", {});
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    notifyInboxUpdated();
  };

  const openCompose = async () => {
    const res = await api.get<UserOption[]>("/inbox/users");
    if (res.success && res.data) {
      setAllUsers(res.data);
    }
    setView("compose");
    setToUserId("");
    setSubject("");
    setContent("");
  };

  const handleSend = async () => {
    if (!toUserId || !subject.trim() || !content.trim()) return;
    setSending(true);
    const res = await api.post("/inbox", {
      toUserId: Number(toUserId),
      subject: subject.trim(),
      content: content.trim(),
    });
    if (res.success) {
      showToast("success", t("inbox.sendSuccess") ?? "Message sent");
      setView("list");
      setTab("inbox");
      setFolder("main");
      fetchMessages();
    } else {
      showToast("error", t("inbox.sendFailed") ?? "Failed to send message");
    }
    setSending(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return d.slice(0, 10);
  };

  const typeIcon = (type: string) => {
    if (type === "task_assignment") return "\u{1F4CB}";
    if (type === "system") return "\u{1F514}";
    return "\u{1F4AC}";
  };

  const unreadCount = messages.filter((m) => !m.read && tab === "inbox" && folder === "main").length;

  const renderList = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-4 h-4 text-blue-500 shrink-0" />
          <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">
            {folder === "trash" ? `${t("inbox.trash")} · ${tab === "inbox" ? t("inbox.received") : t("inbox.sent")}` : t("inbox.title")}
          </h2>
          {folder === "main" && tab === "inbox" && unreadCount > 0 && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {folder === "main" ? (
            <>
              {tab === "inbox" && unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 transition-colors" title={t("inbox.markAllRead") ?? ""}>
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFolder("trash");
                  setView("list");
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title={t("inbox.trash")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={openCompose} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setFolder("main")}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
            >
              {t("inbox.backToList")}
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200/60 dark:border-slate-700/40 shrink-0">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={cn(
            "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
            tab === "inbox" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400",
          )}
        >
          {t("inbox.received")}
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={cn(
            "flex-1 py-2 text-xs font-medium border-b-2 transition-colors",
            tab === "sent" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400",
          )}
        >
          {t("inbox.sent")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectionMode) {
              setSelectionMode(false);
              setSelectedIds([]);
            } else {
              setSelectionMode(true);
            }
          }}
          className={cn(
            "px-3 py-2 text-[11px] font-medium border-b-2 border-transparent transition-colors whitespace-nowrap",
            selectionMode ? "text-blue-600 bg-blue-50/50 dark:bg-blue-500/10" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          )}
        >
          {selectionMode ? t("inbox.cancelSelect") : t("inbox.selectMode")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={folder === "trash" ? t("inbox.trashEmpty") : t("inbox.empty")}
            action={folder === "main" ? { label: t("inbox.compose"), onClick: openCompose } : undefined}
          />
        ) : (
          messages.map((msg) => (
            <InboxMessageItem
              key={msg.id}
              msg={msg}
              tab={tab}
              selectionMode={selectionMode}
              selected={selectedIds.includes(msg.id)}
              onRowActivate={handleRowActivate}
              formatDate={formatDate}
              typeIcon={typeIcon}
            />
          ))
        )}
      </div>

      {selectionMode && selectedIds.length > 0 && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between gap-2 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm">
          <span className="text-[11px] text-slate-500">{selectedIds.length}</span>
          {folder === "main" ? (
            <button
              type="button"
              onClick={handleBulkSoftDelete}
              className="text-xs font-medium text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30"
            >
              {t("inbox.moveToTrashBulk")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBulkPurge}
              className="text-xs font-medium text-red-700 dark:text-red-400 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200/80 dark:border-red-500/30"
            >
              {t("inbox.permanentDelete")}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderDetail = () => {
    if (!selectedMsg) return null;
    const isTrash = folder === "trash";
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40 shrink-0">
          <button
            type="button"
            onClick={() => {
              setView("list");
              setSelectedMsg(null);
            }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex-1 truncate">{selectedMsg.subject}</h3>
          {!isTrash ? (
            <button type="button" onClick={() => void handleSoftDelete(selectedMsg.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title={t("inbox.trash")}>
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void handleRestore(selectedMsg.id)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title={t("inbox.restore")}>
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button type="button" onClick={() => void handlePurge(selectedMsg.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title={t("inbox.permanentDelete")}>
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            <span>
              {tab === "inbox" ? `${t("inbox.from")}: ${selectedMsg.fromName}` : `${t("inbox.to")}: ${selectedMsg.toName}`}
            </span>
            <span>&middot;</span>
            <span>{formatDateTime(selectedMsg.createdAt)}</span>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedMsg.content}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderCompose = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40 shrink-0">
        <button type="button" onClick={() => setView("list")} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("inbox.compose")}</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <select
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value ? Number(e.target.value) : "")}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
        >
          <option value="">{t("inbox.selectRecipient")}</option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.username}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("inbox.subjectPlaceholder")}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("inbox.contentPlaceholder")}
          rows={8}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 resize-y"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!toUserId || !subject.trim() || !content.trim() || sending}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sending ? t("common.loading") : t("inbox.send")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      {view === "list" && renderList()}
      {view === "detail" && renderDetail()}
      {view === "compose" && renderCompose()}
    </div>
  );
}
