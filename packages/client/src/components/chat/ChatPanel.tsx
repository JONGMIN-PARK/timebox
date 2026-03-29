import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useSocket, useSocketEvent } from "@/lib/SocketProvider";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/lib/useI18n";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  ArrowLeft,
  Send,
  Plus,
  Users,
  Settings,
  X,
  Trash2,
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
  type: "direct" | "group";
  lastMessage?: LastMessage | null;
  memberCount: number;
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
}

interface ChatUser {
  id: number;
  username: string;
  displayName: string | null;
}

type View = "rooms" | "chat" | "create";

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
    setView("rooms");
    fetchRooms();
  };

  // ── Send message ──

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeRoom) return;

    // Save message via REST API, then socket broadcasts it
    const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, { content: text });
    if (res.success && res.data) {
      setMessages(prev => [...prev, res.data!]);
      // Notify others via socket
      socket?.emit("chat:message", {
        roomId: String(activeRoom.id),
        message: res.data,
      });
    }

    setInputText("");
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
    return name.charAt(0).toUpperCase();
  };

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
        <button
          onClick={openCreateRoom}
          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
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
          rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => openRoom(room)}
              className="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                    room.type === "direct"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  )}
                >
                  {room.type === "direct" ? (
                    getInitial(getRoomDisplayName(room))
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {getRoomDisplayName(room)}
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
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  CHAT ROOM VIEW
  // ══════════════════════════════════════════

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

              if (isSystem) {
                return (
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
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start", "mt-1")}>
                    <span className="text-[11px] text-slate-400 italic px-3 py-1.5 bg-slate-100 dark:bg-slate-700/30 rounded-xl">
                      {t("chat.deletedMessage")}
                    </span>
                  </div>
                );
              }

              // Image message
              if (msg.type === "image") {
                return (
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
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>

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

              return (
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

                  {/* Message bubble with delete button */}
                  <div className={cn("flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
                    <div
                      className={cn(
                        "max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed",
                        isMe
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {renderContent(msg.content)}
                      </p>
                    </div>
                    {isMe && !msg.deleted && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    )}
                  </div>

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
  //  RENDER
  // ══════════════════════════════════════════

  return (
    <div className="h-full">
      {view === "rooms" && renderRoomList()}
      {view === "chat" && renderChatRoom()}
      {view === "create" && renderCreateRoom()}
    </div>
  );
}
