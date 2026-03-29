import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Send, MessageCircle, Trash2, Smile } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { usePageVisible } from "@/lib/useVisibility";

interface ChatMessage {
  id: number;
  content: string;
  type?: "text" | "image";
  channel: string;
  senderId: number;
  senderName: string;
  createdAt: string;
  deleted?: boolean;
}

interface ProjectChatProps {
  projectId: number;
}

const EMOJI_LIST = ["😀", "😂", "🥰", "😎", "👍", "👏", "🔥", "❤️", "🎉", "💪", "😢", "😡", "🤔", "👀", "✅", "⭐"];

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export default function ProjectChat({ projectId }: ProjectChatProps) {
  const { t } = useI18n();
  const pageVisible = usePageVisible();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [channel] = useState("general");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number>(0);

  // Fetch current user id
  useEffect(() => {
    api.get<{ id: number }>("/auth/me").then((res) => {
      if (res.success && res.data) setMyUserId(res.data.id);
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    const res = await api.get<ChatMessage[]>(
      `/projects/${projectId}/messages?channel=${channel}&limit=50`
    );
    if (res.success && res.data) {
      setMessages(res.data);
      const latest = res.data[res.data.length - 1];
      if (latest && latest.id !== lastMessageIdRef.current) {
        lastMessageIdRef.current = latest.id;
        // Auto-scroll on new messages (only if chat container is visible)
        setTimeout(() => {
          const container = containerRef.current;
          if (container && container.offsetParent !== null) {
            container.scrollTop = container.scrollHeight;
          }
        }, 50);
      }
    }
  }, [projectId, channel]);

  // Initial fetch + polling
  useEffect(() => {
    if (!pageVisible) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages, pageVisible]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    await api.post(`/projects/${projectId}/messages`, { content, channel });
    setSending(false);
    fetchMessages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    await api.delete(`/projects/${projectId}/messages/${messageId}`);
    fetchMessages();
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          setSending(true);
          await api.post(`/projects/${projectId}/messages`, {
            content: dataUrl,
            type: "image",
            channel,
          });
          setSending(false);
          fetchMessages();
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white tracking-tight">
          {t("chat.title")}
        </h2>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-3">
              <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm font-medium">{t("chat.noMessages")}</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderId === myUserId;
          const msgDate = formatDate(msg.createdAt);
          let showDate = false;
          if (msgDate !== lastDate) {
            showDate = true;
            lastDate = msgDate;
          }

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-0.5 rounded-full">
                    {msgDate}
                  </span>
                </div>
              )}
              <div className={cn("flex mb-2", isOwn ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%] group", isOwn ? "items-end" : "items-start")}>
                  {/* Sender name */}
                  <div className={cn("flex items-center gap-2 mb-0.5", isOwn ? "justify-end" : "justify-start")}>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {isOwn ? t("chat.me") : msg.senderName}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  {/* Bubble */}
                  <div className={cn("relative flex items-center gap-1", isOwn ? "flex-row-reverse" : "flex-row")}>
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words",
                        msg.deleted
                          ? "bg-slate-100 dark:bg-slate-700/30 text-slate-400 dark:text-slate-500 italic"
                          : isOwn
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-bl-md"
                      )}
                    >
                      {msg.deleted
                        ? "삭제된 메시지입니다"
                        : msg.type === "image"
                          ? <img src={msg.content} alt="image" className="max-w-full max-h-60 rounded-lg" />
                          : msg.content}
                    </div>
                    {isOwn && !msg.deleted && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-red-500"
                        title="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/40 bg-white/50 dark:bg-slate-800/50">
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg grid grid-cols-8 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Smile className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={t("chat.placeholder")}
            className="input-base flex-1 text-sm"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
              input.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
