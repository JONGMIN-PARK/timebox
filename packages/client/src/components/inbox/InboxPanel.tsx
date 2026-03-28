import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { Mail, Send, Trash2, Check, CheckCheck, ArrowLeft, Plus, X } from "lucide-react";

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

export default function InboxPanel() {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");

  // Compose state
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [toUserId, setToUserId] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    const endpoint = tab === "inbox" ? "/inbox" : "/inbox/sent";
    const res = await api.get<InboxMessage[]>(endpoint);
    if (res.success && res.data) setMessages(res.data);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  const notifyInboxUpdated = () => window.dispatchEvent(new Event("inbox-updated"));

  const handleOpenMsg = async (msg: InboxMessage) => {
    setSelectedMsg(msg);
    setView("detail");
    if (!msg.read && tab === "inbox") {
      await api.put(`/inbox/${msg.id}/read`, {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      notifyInboxUpdated();
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/inbox/${id}`);
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedMsg?.id === id) { setView("list"); setSelectedMsg(null); }
    notifyInboxUpdated();
  };

  const handleMarkAllRead = async () => {
    await api.put("/inbox/read-all", {});
    setMessages(prev => prev.map(m => ({ ...m, read: true })));
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
      setView("list");
      setTab("inbox");
      fetchMessages();
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

  const unreadCount = messages.filter(m => !m.read && tab === "inbox").length;

  // ── List View ──
  const renderList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white">{t("inbox.title")}</h2>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tab === "inbox" && unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors">
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button onClick={openCompose} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/60 dark:border-slate-700/40">
        <button onClick={() => setTab("inbox")} className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", tab === "inbox" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400")}>
          {t("inbox.received")}
        </button>
        <button onClick={() => setTab("sent")} className={cn("flex-1 py-2 text-xs font-medium border-b-2 transition-colors", tab === "sent" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400")}>
          {t("inbox.sent")}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{t("inbox.empty")}</p>
          </div>
        ) : (
          messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => handleOpenMsg(msg)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                !msg.read && tab === "inbox" && "bg-blue-50/50 dark:bg-blue-500/5"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{typeIcon(msg.type)}</span>
                <span className={cn("text-[13px] flex-1 truncate", !msg.read && tab === "inbox" ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                  {msg.subject}
                </span>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 truncate">
                  {tab === "inbox" ? msg.fromName : `\u2192 ${msg.toName}`}
                </span>
                {!msg.read && tab === "inbox" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ── Detail View ──
  const renderDetail = () => {
    if (!selectedMsg) return null;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
          <button onClick={() => { setView("list"); setSelectedMsg(null); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex-1 truncate">{selectedMsg.subject}</h3>
          <button onClick={() => handleDelete(selectedMsg.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{tab === "inbox" ? `${t("inbox.from")}: ${selectedMsg.fromName}` : `${t("inbox.to")}: ${selectedMsg.toName}`}</span>
            <span>&middot;</span>
            <span>{new Date(selectedMsg.createdAt).toLocaleString("ko-KR")}</span>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedMsg.content}</p>
          </div>
        </div>
      </div>
    );
  };

  // ── Compose View ──
  const renderCompose = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <button onClick={() => setView("list")} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("inbox.compose")}</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <select value={toUserId} onChange={(e) => setToUserId(e.target.value ? Number(e.target.value) : "")}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white">
          <option value="">{t("inbox.selectRecipient")}</option>
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
          ))}
        </select>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder={t("inbox.subjectPlaceholder")}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={t("inbox.contentPlaceholder")} rows={8}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 resize-y" />
        <button onClick={handleSend} disabled={!toUserId || !subject.trim() || !content.trim() || sending}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          {sending ? t("common.loading") : t("inbox.send")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full">
      {view === "list" && renderList()}
      {view === "detail" && renderDetail()}
      {view === "compose" && renderCompose()}
    </div>
  );
}
