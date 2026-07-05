import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { api } from "@/lib/api";
import { useSocket, useSocketEvent } from "@/lib/SocketProvider";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/lib/useI18n";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";
import {
  MessageCircle,
  ArrowLeft,
  Send,
  Plus,
  Users,
  Globe,
  Reply,
  Settings,
  X,
  Trash2,
  Trash,
  RotateCcw,
  Smile,
} from "lucide-react";

// ── Types ──

interface LastMessage {
  id: number;
  content: string;
  type: string;
  senderName: string;
  createdAt: string;
}

interface ChatRoom {
  id: number;
  name: string;
  displayName?: string;
  description: string | null;
  type: "direct" | "group" | "global";
  lastMessage?: LastMessage | null;
  memberCount: number;
  createdBy?: number;
  deletedAt?: string | null;
}

interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
}
interface ReplyPreview {
  id: number;
  senderName: string;
  content: string;
  type: string;
}
interface ChatMessage {
  id: number;
  roomId: number;
  userId: number;
  senderName: string;
  content: string;
  type: string;
  deleted?: boolean;
  readBy?: string;
  createdAt: string;
  replyTo?: number | null;
  replyToMessage?: ReplyPreview | null;
  reactions?: MessageReaction[];
}

// KakaoTalk-style quick reactions (공감)
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

interface ChatUser {
  id: number;
  username: string;
  displayName: string | null;
}

type View = "rooms" | "chat" | "create" | "trash";

const EMOJIS = ["😀","😂","🥰","😎","👍","👏","🔥","❤️","🎉","💪","😢","😡","🤔","👀","✅","⭐"];

// ── Component ──

export default function ChatPanel() {
  const { t } = useI18n();
  const keyboardHeight = useKeyboardHeight();
  const user = useAuthStore((s) => s.user);
  const socket = useSocket();

  // View state
  const [view, setView] = useState<View>("rooms");

  // Room list state
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Chat room state
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  // KakaoTalk-style: message being replied to, and which message's reaction picker is open.
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Emoji picker state
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Create room state
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(),
  );
  const [creating, setCreating] = useState(false);

  // ── Close emoji picker on outside click ──

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    if (showEmoji) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmoji]);

  // ── Fetch rooms ──

  const fetchRooms = useCallback(async () => {
    const res = await api.get<ChatRoom[]>("/chat");
    if (res.success && res.data) setRooms(res.data);
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // ── Trash (soft-deleted rooms) ──
  const [trashedRooms, setTrashedRooms] = useState<ChatRoom[]>([]);
  const [confirmPurgeId, setConfirmPurgeId] = useState<number | null>(null);

  const fetchTrash = useCallback(async () => {
    const res = await api.get<ChatRoom[]>("/chat/trash");
    if (res.success && res.data) setTrashedRooms(res.data);
  }, []);

  // Move a room to trash (soft delete). Recoverable from the trash view.
  const trashRoom = useCallback(async (room: ChatRoom) => {
    const res = await api.delete(`/chat/${room.id}`);
    if (res.success) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      showToast("success", t("chat.movedToTrash") || "휴지통으로 이동했습니다");
    } else {
      showToast("error", res.error || (t("chat.deleteFailed") || "삭제 실패"));
    }
  }, [t]);

  const restoreRoom = useCallback(async (room: ChatRoom) => {
    const res = await api.post(`/chat/${room.id}/restore`, {});
    if (res.success) {
      setTrashedRooms((prev) => prev.filter((r) => r.id !== room.id));
      fetchRooms();
      showToast("success", t("chat.restored") || "복원했습니다");
    }
  }, [fetchRooms, t]);

  const purgeRoom = useCallback(async (roomId: number) => {
    const res = await api.delete(`/chat/${roomId}/permanent`);
    if (res.success) {
      setTrashedRooms((prev) => prev.filter((r) => r.id !== roomId));
      showToast("success", t("chat.deletedPermanent") || "영구 삭제했습니다");
    }
    setConfirmPurgeId(null);
  }, [t]);

  // Keep room lists in sync when a room is trashed/restored elsewhere.
  useSocketEvent("chat:rooms-updated", useCallback(() => {
    fetchRooms();
    fetchTrash();
  }, [fetchRooms, fetchTrash]));

  // ── Socket: real-time messages ──

  // Use refs for values needed inside the socket handler to avoid re-subscriptions
  const activeRoomRef = useRef(activeRoom);
  activeRoomRef.current = activeRoom;

  useSocketEvent("chat:message", useCallback((data: { userId: number; roomId: string; message: ChatMessage }) => {
    const msg = data.message;
    if (!msg) return;
    // Skip own messages (already added via REST response)
    if (msg.userId === user?.id) return;
    // If we're in the active room, append message
    if (activeRoomRef.current && String(activeRoomRef.current.id) === data.roomId) {
      setMessages((prev) => [...prev, msg]);
    }
    // Update room list with latest message
    const roomId = parseInt(data.roomId);
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === roomId) {
          return {
            ...r,
            lastMessage: { id: msg.id, content: msg.content, type: msg.type, senderName: msg.senderName, createdAt: msg.createdAt },
          };
        }
        return r;
      }),
    );
  }, [user?.id]));

  // ── Realtime reactions: merge new counts, preserve MY own `mine` flags ──
  useSocketEvent("chat:reaction", useCallback((data: { roomId: number; messageId: number; reactions: MessageReaction[] }) => {
    if (!activeRoomRef.current || activeRoomRef.current.id !== data.roomId) return;
    setMessages((prev) => prev.map((m) => {
      if (m.id !== data.messageId) return m;
      const merged = data.reactions.map((r) => ({
        ...r,
        mine: m.reactions?.find((e) => e.emoji === r.emoji)?.mine ?? false,
      }));
      return { ...m, reactions: merged };
    }));
  }, []));

  // ── Auto-scroll on new messages ──

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // ── Open a chat room ──

  const openRoom = async (room: ChatRoom) => {
    setActiveRoom(room);
    setView("chat");
    setMessagesLoading(true);
    setMessages([]);

    socket?.emit("chat:join", String(room.id));

    const res = await api.get<ChatMessage[]>(`/chat/${room.id}/messages`);
    if (res.success && res.data) setMessages(res.data);
    setMessagesLoading(false);

    // Mark messages as read
    await api.put(`/chat/${room.id}/read`, {});
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)),
    );
  };

  // ── Leave room (go back) ──

  const leaveRoom = () => {
    if (activeRoom) {
      socket?.emit("chat:leave", String(activeRoom.id));
    }
    setActiveRoom(null);
    setMessages([]);
    setInputText("");
    setShowEmoji(false);
    setReplyingTo(null);
    setReactionPickerFor(null);
    setView("rooms");
    fetchRooms();
  };

  // ── Send message ──

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeRoom) return;

    // Save message via REST API, then socket broadcasts it
    const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, {
      content: text,
      replyTo: replyingTo?.id ?? null,
    });
    if (res.success && res.data) {
      setMessages(prev => [...prev, res.data!]);
      // Notify others via socket
      socket?.emit("chat:message", {
        roomId: String(activeRoom.id),
        message: res.data,
      });
    }

    setInputText("");
    setReplyingTo(null);
  };

  // ── Toggle an emoji reaction (공감) ──
  const toggleReaction = async (messageId: number, emoji: string) => {
    if (!activeRoom) return;
    setReactionPickerFor(null);
    const res = await api.post<{ messageId: number; reactions: MessageReaction[] }>(
      `/chat/${activeRoom.id}/messages/${messageId}/reactions`, { emoji },
    );
    if (res.success && res.data) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: res.data!.reactions } : m));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Delete message ──

  const handleDeleteMessage = async (messageId: number) => {
    if (!activeRoom) return;
    const res = await api.delete(`/chat/${activeRoom.id}/messages/${messageId}`);
    if (res.success) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, content: "" } : m
      ));
    }
  };

  // ── Image paste support ──

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file || !activeRoom) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, {
            content: dataUrl,
            type: "image",
          });
          if (res.success && res.data) {
            setMessages(prev => [...prev, res.data!]);
            socket?.emit("chat:message", { roomId: String(activeRoom.id), message: res.data });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // ── Emoji insert ──

  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmoji(false);
  };

  // ── Create room ──

  const openCreateRoom = async () => {
    setView("create");
    setRoomName("");
    setRoomDescription("");
    setSelectedUserIds(new Set());

    const res = await api.get<ChatUser[]>("/inbox/users");
    if (res.success && res.data) {
      setAllUsers(res.data.filter((u) => u.id !== user?.id));
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim() || selectedUserIds.size === 0) return;
    setCreating(true);

    const res = await api.post<ChatRoom>("/chat", {
      name: roomName.trim(),
      description: roomDescription.trim() || null,
      memberIds: Array.from(selectedUserIds),
    });

    if (res.success && res.data) {
      await fetchRooms();
      openRoom(res.data);
    }
    setCreating(false);
  };

  // ── Formatting helpers ──

  const formatTime = (d: string) => {
    const date = new Date(d);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const formatRoomTime = (d?: string) => {
    if (!d) return "";
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return formatTime(d);
    }
    return d.slice(0, 10);
  };

  const getInitial = (name: string) => {
    return (name || "?").charAt(0).toUpperCase();
  };

  // ── Date-divider helpers (KakaoTalk-style day separators) ──
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
  const dayLabel = (iso: string) => {
    const d = dayKey(iso);
    const today = new Date().toLocaleDateString("en-CA");
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
    if (d === today) return t("chat.today") || "오늘";
    if (d === yesterday) return t("chat.yesterday") || "어제";
    const dt = new Date(iso);
    return `${dt.getFullYear()}. ${dt.getMonth() + 1}. ${dt.getDate()}`;
  };

  // Short preview text for a replied-to message.
  const replyPreviewText = (r: ReplyPreview) =>
    r.type === "image" ? "📷 사진" : (r.content || t("chat.deletedMessage"));

  const renderContent = (text: string) => {
    return text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith("@")
        ? <span key={i} className="text-blue-500 font-medium cursor-pointer hover:underline">{part}</span>
        : part
    );
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    return room.displayName || room.name;
  };

  // ── Helper: group consecutive messages by same sender ──

  const isNewGroup = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (msg.type === "system" || prev.type === "system") return true;
    return prev.userId !== msg.userId;
  };

  // ══════════════════════════════════════════
  //  ROOM LIST VIEW
  // ══════════════════════════════════════════

  const renderRoomList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white">
            Chat
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setView("trash"); fetchTrash(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            title={t("chat.trash") || "휴지통"}
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openCreateRoom}
            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        {roomsLoading ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            {t("common.loading")}
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No chat rooms yet</p>
            <p className="text-xs mt-1 text-slate-400">
              Tap + to start a conversation
            </p>
          </div>
        ) : (
          // Pin the all-members room to the top; keep other rooms' order.
          [...rooms].sort((a, b) => (b.type === "global" ? 1 : 0) - (a.type === "global" ? 1 : 0)).map((room) => (
            <div
              key={room.id}
              onClick={() => openRoom(room)}
              className="group w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center gap-3"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                  room.type === "direct"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : room.type === "global"
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                )}
              >
                {room.type === "direct" ? (
                  getInitial(getRoomDisplayName(room))
                ) : room.type === "global" ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{getRoomDisplayName(room)}</span>
                    {room.type === "global" && (
                      <span className="shrink-0 text-[9px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded-full">
                        {t("chat.everyone") || "전체"}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                    {formatRoomTime(room.lastMessage?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-slate-400 truncate">
                    {room.lastMessage?.content || "No messages yet"}
                  </span>
                </div>
              </div>

              {/* Owner-only: move room to trash (never the all-members room) */}
              {room.type !== "global" && room.createdBy === user?.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); trashRoom(room); }}
                  className="shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                  title={t("chat.deleteRoom") || "방 삭제"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  CHAT ROOM VIEW
  // ══════════════════════════════════════════

  // Hover/tap actions on a message: 답장(reply) + 공감(reaction picker) + delete(own).
  const renderMsgActions = (msg: ChatMessage, isMe: boolean) => (
    <div className={cn("flex items-center gap-0.5", isMe ? "flex-row-reverse" : "flex-row")}>
      <div className="relative">
        <button
          onClick={() => setReactionPickerFor((cur) => (cur === msg.id ? null : msg.id))}
          className="opacity-0 group-hover:opacity-100 max-md:opacity-100 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
          title={t("chat.react") || "공감"}
        >
          <Smile className="w-3.5 h-3.5 text-slate-400" />
        </button>
        {reactionPickerFor === msg.id && (
          <div className={cn(
            "absolute z-20 bottom-full mb-1 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-600",
            isMe ? "right-0" : "left-0",
          )}>
            {REACTION_EMOJIS.map((e) => (
              <button key={e} onClick={() => toggleReaction(msg.id, e)} className="text-lg leading-none hover:scale-125 transition-transform p-0.5">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => { setReplyingTo(msg); setReactionPickerFor(null); }}
        className="opacity-0 group-hover:opacity-100 max-md:opacity-100 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
        title={t("chat.reply") || "답장"}
      >
        <Reply className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {isMe && (
        <button
          onClick={() => handleDeleteMessage(msg.id)}
          className="opacity-0 group-hover:opacity-100 max-md:opacity-100 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title={t("common.delete")}
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  );

  // Reaction chips shown under a message bubble.
  const renderReactionChips = (msg: ChatMessage, isMe: boolean) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;
    return (
      <div className={cn("flex flex-wrap gap-1 mt-1", isMe ? "justify-end mr-1" : "ml-1")}>
        {msg.reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => toggleReaction(msg.id, r.emoji)}
            className={cn(
              "flex items-center gap-0.5 text-[11px] leading-none px-1.5 py-0.5 rounded-full border transition-colors",
              r.mine
                ? "bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-500/50 text-blue-700 dark:text-blue-300"
                : "bg-slate-100 dark:bg-slate-700 border-transparent text-slate-500 dark:text-slate-400",
            )}
          >
            <span className="text-xs">{r.emoji}</span>
            <span className="tabular-nums font-medium">{r.count}</span>
          </button>
        ))}
      </div>
    );
  };

  // Quoted preview shown inside a bubble that is a reply.
  const renderReplyQuote = (r: ReplyPreview, isMe: boolean) => (
    <div className={cn(
      "mb-1 pl-2 border-l-2 text-[11px] truncate max-w-full",
      isMe ? "border-white/50 text-white/80" : "border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400",
    )}>
      <span className="font-medium">{r.senderName || "?"}</span>
      <span className="mx-1 opacity-70">·</span>
      <span className="opacity-80">{replyPreviewText(r)}</span>
    </div>
  );

  const renderChatRoom = () => {
    if (!activeRoom) return null;

    return (
      <div className="flex flex-col h-full" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
          <button
            onClick={leaveRoom}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {getRoomDisplayName(activeRoom)}
            </h3>
            <span className="text-[10px] text-slate-400">
              {activeRoom.memberCount} members
            </span>
          </div>
          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        >
          {messagesLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {t("common.loading")}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.userId === user?.id;
              const isSystem = msg.type === "system";
              const showHeader = isNewGroup(msg, idx);

              // Prepend a date divider when the calendar day changes.
              const needDivider = idx === 0 || dayKey(messages[idx - 1].createdAt) !== dayKey(msg.createdAt);
              const withDivider = (el: React.ReactNode) =>
                needDivider ? (
                  <Fragment key={`m-${msg.id}`}>
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/60 px-2.5 py-0.5 rounded-full">
                        {dayLabel(msg.createdAt)}
                      </span>
                    </div>
                    {el}
                  </Fragment>
                ) : el;

              if (isSystem) {
                return withDivider(
                  <div
                    key={msg.id}
                    className="flex justify-center py-2"
                  >
                    <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              // Deleted message placeholder
              if (msg.deleted) {
                return withDivider(
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start", "mt-1")}>
                    <span className="text-[11px] text-slate-400 italic px-3 py-1.5 bg-slate-100 dark:bg-slate-700/30 rounded-xl">
                      {t("chat.deletedMessage")}
                    </span>
                  </div>
                );
              }

              // Image message
              if (msg.type === "image") {
                return withDivider(
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col group",
                      isMe ? "items-end" : "items-start",
                      showHeader ? "mt-3" : "mt-0.5",
                    )}
                  >
                    {showHeader && !isMe && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            {getInitial(msg.senderName)}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {msg.senderName}
                        </span>
                      </div>
                    )}

                    <div className={cn("flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
                      <img
                        src={msg.content}
                        alt="shared image"
                        className="max-w-[min(240px,70vw)] rounded-xl cursor-pointer"
                        onClick={() => window.open(msg.content, "_blank")}
                      />
                      {renderMsgActions(msg, isMe)}
                    </div>

                    {renderReactionChips(msg, isMe)}

                    <span
                      className={cn(
                        "text-[9px] text-slate-400 mt-0.5",
                        isMe ? "mr-1" : "ml-1",
                      )}
                    >
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                );
              }

              return withDivider(
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col group",
                    isMe ? "items-end" : "items-start",
                    showHeader ? "mt-3" : "mt-0.5",
                  )}
                >
                  {/* Sender info */}
                  {showHeader && !isMe && (
                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {getInitial(msg.senderName)}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {msg.senderName}
                      </span>
                    </div>
                  )}

                  {/* Message bubble with actions */}
                  <div className={cn("flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
                    <div
                      className={cn(
                        "max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed",
                        isMe
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md",
                      )}
                    >
                      {msg.replyToMessage && renderReplyQuote(msg.replyToMessage, isMe)}
                      <p className="whitespace-pre-wrap break-words">
                        {renderContent(msg.content)}
                      </p>
                    </div>
                    {renderMsgActions(msg, isMe)}
                  </div>

                  {renderReactionChips(msg, isMe)}

                  {/* Time + read receipt */}
                  <span
                    className={cn(
                      "text-[9px] text-slate-400 mt-0.5",
                      isMe ? "mr-1" : "ml-1",
                    )}
                  >
                    {formatTime(msg.createdAt)}
                    {isMe && !msg.deleted && (
                      <span className="text-[9px] text-slate-400 ml-0.5">
                        {msg.readBy && JSON.parse(msg.readBy || "[]").length > 0 ? "\u2713\u2713" : "\u2713"}
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-3 py-2 border-t border-slate-200/60 dark:border-slate-700/40">
          {/* Reply-to preview chip (답장) */}
          {replyingTo && (
            <div className="flex items-center gap-2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 border-l-2 border-blue-500">
              <Reply className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">
                  {replyingTo.senderName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {replyingTo.type === "image" ? "📷 사진" : replyingTo.content}
                </p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0" aria-label={t("common.cancel")}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 resize-none max-h-24 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />

            {/* Emoji picker */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={() => setShowEmoji(prev => !prev)}
                className="p-2 rounded-xl transition-colors bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex-shrink-0"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full mb-2 right-0 p-2 grid grid-cols-8 sm:grid-cols-4 gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 max-w-[calc(100vw-2rem)]">
                  <div className="grid grid-cols-8 sm:grid-cols-4 gap-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={sendMessage}
              disabled={!inputText.trim()}
              className={cn(
                "p-2 rounded-xl transition-colors flex-shrink-0",
                inputText.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400",
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════
  //  CREATE ROOM VIEW
  // ══════════════════════════════════════════

  const renderCreateRoom = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <button
          onClick={() => setView("rooms")}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          New Chat Room
        </h3>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Room name */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Room Name
          </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={roomDescription}
            onChange={(e) => setRoomDescription(e.target.value)}
            placeholder="What's this room about?"
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Member selection */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Members ({selectedUserIds.size} selected)
          </label>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {allUsers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                {t("common.loading")}
              </div>
            ) : (
              allUsers.map((u) => {
                const selected = selectedUserIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 transition-colors",
                      selected
                        ? "bg-blue-50 dark:bg-blue-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        selected
                          ? "bg-blue-600 border-blue-600"
                          : "border-slate-300 dark:border-slate-600",
                      )}
                    >
                      {selected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>

                    {/* User avatar */}
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {getInitial(u.displayName || u.username)}
                      </span>
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-slate-800 dark:text-slate-200 truncate block">
                        {u.displayName || u.username}
                      </span>
                      {u.displayName && (
                        <span className="text-[10px] text-slate-400 truncate block">
                          @{u.username}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected tags */}
        {selectedUserIds.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allUsers
              .filter((u) => selectedUserIds.has(u.id))
              .map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 text-[11px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full"
                >
                  {u.displayName || u.username}
                  <button
                    onClick={() => toggleUser(u.id)}
                    className="hover:text-blue-900 dark:hover:text-blue-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        )}

        {/* Create button */}
        <button
          onClick={handleCreateRoom}
          disabled={!roomName.trim() || selectedUserIds.size === 0 || creating}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          {creating ? t("common.loading") : "Create Room"}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  TRASH VIEW
  // ══════════════════════════════════════════

  const renderTrash = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <button onClick={() => setView("rooms")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Trash className="w-4 h-4 text-slate-500" />
        <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white">{t("chat.trash") || "휴지통"}</h2>
        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">{trashedRooms.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trashedRooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Trash className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">{t("chat.trashEmpty") || "휴지통이 비어 있습니다"}</p>
          </div>
        ) : (
          trashedRooms.map((room) => (
            <div key={room.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                room.type === "direct" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              )}>
                {room.type === "direct" ? getInitial(getRoomDisplayName(room)) : <Users className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{getRoomDisplayName(room)}</p>
                <p className="text-[10px] text-slate-400 truncate">{room.deletedAt ? formatRoomTime(room.deletedAt) : ""}</p>
              </div>
              <button onClick={() => restoreRoom(room)} className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <RotateCcw className="w-3.5 h-3.5" /> {t("chat.restore") || "복원"}
              </button>
              <button onClick={() => setConfirmPurgeId(room.id)} className="shrink-0 p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title={t("chat.deleteForever") || "영구 삭제"}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════

  return (
    <div className="h-full">
      {view === "rooms" && renderRoomList()}
      {view === "chat" && renderChatRoom()}
      {view === "create" && renderCreateRoom()}
      {view === "trash" && renderTrash()}

      {/* Permanent-delete confirmation */}
      {confirmPurgeId !== null && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" onClick={() => setConfirmPurgeId(null)}>
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("chat.confirmPurgeTitle") || "영구 삭제하시겠어요?"}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("chat.confirmPurgeMsg") || "방과 모든 메시지가 영구 삭제되며 복구할 수 없습니다."}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmPurgeId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">{t("common.cancel") || "취소"}</button>
              <button onClick={() => purgeRoom(confirmPurgeId)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium">{t("chat.deleteForever") || "영구 삭제"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
