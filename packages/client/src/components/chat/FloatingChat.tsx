import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  X,
  ArrowLeft,
  Send,
  Search,
  Command,
  User,
  Paperclip,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";

// ── Types ──

interface ChatRoom {
  id: number;
  name: string;
  displayName?: string;
  description: string | null;
  type: "direct" | "group";
  lastMessage?: {
    id: number;
    content: string;
    type: string;
    senderName: string;
    createdAt: string;
  } | null;
  memberCount: number;
  unreadCount?: number;
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

interface OnlineUser {
  userId: number;
  displayName: string;
  username: string;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/todo", label: "/todo [title]", description: "Create a todo" },
  { command: "/meeting", label: "/meeting [title]", description: "Schedule a meeting (today)" },
  { command: "/remind", label: "/remind [title]", description: "Set a reminder" },
  { command: "/assign", label: "/assign [title]", description: "Assign a task to partner (inbox)" },
];

// ── Component ──

export default function FloatingChat() {
  const user = useAuthStore((s) => s.user);

  // UI state
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"contacts" | "chat">("contacts");
  const [searchQuery, setSearchQuery] = useState("");

  // Chat state
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [activePartner, setActivePartner] = useState<{ id: number; name: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");

  // Contacts state
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentRooms, setRecentRooms] = useState<ChatRoom[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Command state
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(SLASH_COMMANDS);
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Escape key handler ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCommands) {
          setShowCommands(false);
        } else if (view === "chat") {
          leaveRoom();
        } else if (open) {
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, view, showCommands]);

  // ── Fetch contacts and recent rooms ──

  const fetchContacts = useCallback(async () => {
    const [usersRes, roomsRes] = await Promise.all([
      api.get<ChatUser[]>("/inbox/users"),
      api.get<ChatRoom[]>("/chat"),
    ]);
    if (usersRes.success && usersRes.data) {
      setAllUsers(usersRes.data.filter((u) => u.id !== user?.id));
    }
    if (roomsRes.success && roomsRes.data) {
      const directRooms = roomsRes.data.filter((r) => r.type === "direct");
      setRecentRooms(directRooms);
      const total = directRooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
      setUnreadCount(total);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    fetchContacts();
  }, [user, fetchContacts]);

  // ── Fetch online users ──

  useEffect(() => {
    if (!user) return;
    const fetchOnline = async () => {
      const res = await api.get<OnlineUser[]>("/presence/online");
      if (res.success && res.data) {
        setOnlineUsers(res.data.filter((u) => u.userId !== user.id));
        setOnlineUserIds(new Set(res.data.map((u) => u.userId)));
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Socket: real-time messages ──

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const handleNewMessage = (data: { userId: number; roomId: string; message: ChatMessage }) => {
      const msg = data.message;
      if (!msg) return;
      if (msg.userId === user.id) return;

      if (activeRoom && String(activeRoom.id) === data.roomId) {
        setMessages((prev) => [...prev, msg]);
      } else {
        // Increment unread count for messages not in active room
        setUnreadCount((prev) => prev + 1);
      }

      // Update recent rooms
      const roomId = parseInt(data.roomId);
      setRecentRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                lastMessage: {
                  id: msg.id,
                  content: msg.content,
                  type: msg.type,
                  senderName: msg.senderName,
                  createdAt: msg.createdAt,
                },
              }
            : r,
        ),
      );
    };

    socket.on("chat:message", handleNewMessage);
    return () => {
      socket.off("chat:message", handleNewMessage);
    };
  }, [activeRoom, user]);

  // ── Auto-scroll on new messages ──

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // ── Open/create direct room with a user ──

  const openDirectChat = async (targetUser: ChatUser | OnlineUser) => {
    const targetId = "userId" in targetUser ? targetUser.userId : targetUser.id;
    const targetName =
      "displayName" in targetUser && targetUser.displayName
        ? targetUser.displayName
        : "username" in targetUser
          ? targetUser.username
          : (targetUser as OnlineUser).displayName || (targetUser as OnlineUser).username;

    setActivePartner({ id: targetId, name: targetName });

    // Check if we already have a direct room with this user
    const existingRoom = recentRooms.find(
      (r) => r.type === "direct" && (r.displayName === targetName || r.name === targetName),
    );

    if (existingRoom) {
      await openRoom(existingRoom);
      return;
    }

    // Create a direct room
    const res = await api.post<{ id: number }>("/chat/direct", {
      targetUserId: targetId,
    });

    if (res.success && res.data) {
      const roomId = res.data.id;
      const newRoom: ChatRoom = {
        id: roomId,
        name: targetName,
        displayName: targetName,
        description: null,
        type: "direct",
        memberCount: 2,
      };
      setRecentRooms((prev) => [newRoom, ...prev]);
      await openRoom(newRoom);
    }
  };

  // ── Open a chat room ──

  const openRoom = async (room: ChatRoom) => {
    setActiveRoom(room);
    setView("chat");
    setMessagesLoading(true);
    setMessages([]);
    setInput("");
    setShowCommands(false);

    const socket = getSocket();
    socket.emit("chat:join", String(room.id));

    const res = await api.get<ChatMessage[]>(`/chat/${room.id}/messages`);
    if (res.success && res.data) setMessages(res.data);
    setMessagesLoading(false);

    await api.put(`/chat/${room.id}/read`, {});
    setRecentRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)),
    );

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Leave room ──

  const leaveRoom = () => {
    if (activeRoom) {
      const socket = getSocket();
      socket.emit("chat:leave", String(activeRoom.id));
    }
    setActiveRoom(null);
    setActivePartner(null);
    setMessages([]);
    setInput("");
    setShowCommands(false);
    setView("contacts");
    fetchContacts();
  };

  // ── Slash command handling ──

  const handleSlashCommand = async (text: string): Promise<boolean> => {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const title = parts.slice(1).join(" ");

    if (!title) return false;

    let confirmationMsg = "";

    switch (cmd) {
      case "/todo": {
        const res = await api.post("/todos", { title });
        if (res.success) {
          confirmationMsg = "\u2705 Todo '" + title + "' created";
        }
        break;
      }
      case "/meeting": {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 1);
        startTime.setMinutes(0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);
        const res = await api.post("/events", {
          title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
        if (res.success) {
          const timeStr = startTime.getHours().toString().padStart(2, "0") + ":00";
          confirmationMsg = "\u2705 Meeting '" + title + "' scheduled (today " + timeStr + ")";
        }
        break;
      }
      case "/remind": {
        const res = await api.post("/reminders", { title });
        if (res.success) {
          confirmationMsg = "\u2705 Reminder '" + title + "' created";
        }
        break;
      }
      case "/assign": {
        if (!activePartner) return false;
        const res = await api.post("/inbox", {
          recipientId: activePartner.id,
          content: "[Task assigned] " + title,
          type: "task",
        });
        if (res.success) {
          confirmationMsg = "\u2705 Task '" + title + "' assigned to " + activePartner.name;
        }
        break;
      }
      default:
        return false;
    }

    if (confirmationMsg && activeRoom) {
      // Send confirmation as a system-style message in chat
      const socket = getSocket();
      const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, {
        content: confirmationMsg,
      });
      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data!]);
        socket.emit("chat:message", {
          roomId: String(activeRoom.id),
          message: res.data,
        });
      }
    }

    return true;
  };

  // ── Send message ──

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeRoom) return;

    // Check if it's a slash command
    if (text.startsWith("/")) {
      const handled = await handleSlashCommand(text);
      if (handled) {
        setInput("");
        setShowCommands(false);
        return;
      }
    }

    const socket = getSocket();
    const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, {
      content: text,
    });
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data!]);
      socket.emit("chat:message", {
        roomId: String(activeRoom.id),
        message: res.data,
      });
    } else {
      showToast("error", "Failed to send message");
    }

    setInput("");
    setShowCommands(false);
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    if (value.startsWith("/")) {
      const query = value.toLowerCase();
      const filtered = SLASH_COMMANDS.filter(
        (c) => c.command.startsWith(query.split(" ")[0]),
      );
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0 && !value.includes(" "));
      setSelectedCommandIdx(0);
    } else {
      setShowCommands(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showCommands) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIdx((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIdx((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1,
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !input.includes(" "))) {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIdx];
        if (selected) {
          setInput(selected.command + " ");
          setShowCommands(false);
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
    if (date.toDateString() === now.toDateString()) return formatTime(d);
    return d.slice(0, 10);
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const isNewGroup = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (msg.type === "system" || prev.type === "system") return true;
    return prev.userId !== msg.userId;
  };

  // ── Filter contacts by search ──

  const filteredUsers = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q))
    );
  });

  const filteredOnlineUsers = onlineUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q)
    );
  });

  const filteredRooms = recentRooms.filter((r) => {
    const q = searchQuery.toLowerCase();
    const name = r.displayName || r.name;
    return name.toLowerCase().includes(q);
  });

  if (!user) return null;

  // ── Render: Contact List ──

  const renderContacts = () => (
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
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700/50 border-0 outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Contact sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent conversations */}
        {filteredRooms.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recent chats
            </div>
            {filteredRooms.map((room) => (
              <button
                key={`room-${room.id}`}
                onClick={() => openRoom(room)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {getInitial(room.displayName || room.name)}
                  </div>
                  {onlineUserIds.has(
                    allUsers.find(
                      (u) =>
                        u.displayName === room.displayName ||
                        u.username === room.name,
                    )?.id || -1,
                  ) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {room.displayName || room.name}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                      {formatRoomTime(room.lastMessage?.createdAt)}
                    </span>
                  </div>
                  {room.lastMessage && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {room.lastMessage.content}
                    </p>
                  )}
                </div>
                {(room.unreadCount || 0) > 0 && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {room.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Online users */}
        {filteredOnlineUsers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Online
            </div>
            {filteredOnlineUsers.map((ou) => (
              <button
                key={`online-${ou.userId}`}
                onClick={() => openDirectChat(ou)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-medium">
                    {getInitial(ou.displayName || ou.username)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm text-slate-900 dark:text-white truncate block">
                    {ou.displayName || ou.username}
                  </span>
                  {ou.displayName && (
                    <span className="text-[11px] text-slate-400 truncate block">
                      @{ou.username}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* All users */}
        {filteredUsers.length > 0 && (
          <div>
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              All users
            </div>
            {filteredUsers.map((u) => (
              <button
                key={`user-${u.id}`}
                onClick={() => openDirectChat(u)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 dark:from-slate-500 dark:to-slate-700 flex items-center justify-center text-white text-xs font-medium">
                    {getInitial(u.displayName || u.username)}
                  </div>
                  {onlineUserIds.has(u.id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-sm text-slate-900 dark:text-white truncate block">
                    {u.displayName || u.username}
                  </span>
                  {u.displayName && (
                    <span className="text-[11px] text-slate-400 truncate block">
                      @{u.username}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredRooms.length === 0 &&
          filteredOnlineUsers.length === 0 &&
          filteredUsers.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">No results found</p>
            </div>
          )}
      </div>
    </div>
  );

  // ── Render: Chat Room ──

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-700/40">
        <button
          onClick={leaveRoom}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {activeRoom?.displayName || activeRoom?.name || activePartner?.name}
          </h3>
          {activePartner && onlineUserIds.has(activePartner.id) && (
            <span className="text-[10px] text-green-500 font-medium">Online</span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
      >
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageCircle className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">Start a conversation</p>
            <p className="text-xs mt-1 text-slate-400">
              Type / to use slash commands
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isOwn = msg.userId === user.id;
              const showHeader = isNewGroup(msg, idx);
              const isSystem = msg.type === "system";

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center py-1.5"
                  >
                    <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              // Check if this is a command confirmation message
              const isCommandMsg = msg.content.startsWith("\u2705");

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isOwn ? "justify-end" : "justify-start",
                    showHeader ? "mt-3" : "mt-0.5",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%]",
                      isOwn ? "items-end" : "items-start",
                    )}
                  >
                    {showHeader && !isOwn && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1 mb-0.5 block">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={cn(
                        "px-3 py-1.5 rounded-2xl text-sm leading-relaxed break-words",
                        isCommandMsg
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50"
                          : isOwn
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-md",
                      )}
                    >
                      {msg.deleted ? (
                        <span className="italic text-slate-400 text-xs">
                          Deleted message
                        </span>
                      ) : (
                        msg.content
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] text-slate-400 mt-0.5 block",
                        isOwn ? "text-right mr-1" : "ml-1",
                      )}
                    >
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Slash command popup */}
      {showCommands && (
        <div className="mx-3 mb-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Command className="w-3 h-3" />
              Commands
            </div>
          </div>
          {filteredCommands.map((cmd, idx) => (
            <button
              key={cmd.command}
              onClick={() => {
                setInput(cmd.command + " ");
                setShowCommands(false);
                inputRef.current?.focus();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                idx === selectedCommandIdx
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/40",
              )}
            >
              <code className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                {cmd.label}
              </code>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {cmd.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 py-2 border-t border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a message... (/ for commands)"
            className="flex-1 px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-700/50 border-0 outline-none focus:ring-2 focus:ring-blue-500/40 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <label className="p-2 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-blue-500">
            <Paperclip className="w-4 h-4" />
            <input type="file" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !activeRoom) return;
              if (file.size > 10 * 1024 * 1024) { showToast("error", "File size must be 10MB or less"); return; }
              const reader = new FileReader();
              reader.onload = async () => {
                const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, {
                  content: reader.result as string,
                  type: file.type.startsWith("image/") ? "image" : "file",
                });
                if (res.success && res.data) {
                  setMessages(prev => [...prev, res.data!]);
                  const socket = getSocket();
                  socket.emit("chat:message", { roomId: String(activeRoom.id), message: res.data });
                }
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className={cn(
              "p-2 rounded-xl transition-all",
              input.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                : "bg-slate-100 dark:bg-slate-700/50 text-slate-400",
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main render ──

  return (
    <>
      {/* Chat Popup */}
      <div
        ref={popupRef}
        className={cn(
          "fixed right-4 bottom-24 w-[350px] h-[480px] rounded-2xl shadow-2xl overflow-hidden",
          "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60",
          "flex flex-col",
          "transition-all duration-300 ease-out origin-bottom-right",
          // Mobile: full width
          "max-md:left-2 max-md:right-2 max-md:w-auto max-md:bottom-20",
          // Backdrop blur
          "backdrop-blur-sm",
          open
            ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
            : "opacity-0 scale-90 pointer-events-none translate-y-4",
        )}
        style={{ zIndex: 45 }}
      >
        {view === "contacts" ? renderContacts() : renderChat()}
      </div>

      {/* Chat Bubble Button */}
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) {
            setView("contacts");
            setSearchQuery("");
            fetchContacts();
          }
        }}
        className={cn(
          "fixed right-4 bottom-[4.5rem] md:right-6 md:bottom-6 w-14 h-14 rounded-full shadow-lg",
          "flex items-center justify-center transition-all duration-300",
          "hover:shadow-xl hover:scale-105 active:scale-95",
          open
            ? "bg-slate-600 dark:bg-slate-700 ring-2 ring-slate-400/50"
            : unreadCount > 0
              ? "bg-blue-500 hover:bg-blue-600 ring-2 ring-blue-400/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
              : "bg-slate-400 dark:bg-slate-600 hover:bg-blue-500 dark:hover:bg-blue-600",
        )}
        style={{ zIndex: 45 }}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className={cn(
              "w-6 h-6 transition-colors",
              unreadCount > 0 ? "text-white" : "text-white/70",
            )} />
            {/* Pulse animation for unread */}
            {unreadCount > 0 && (
              <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
            )}
          </>
        )}

        {/* Unread badge */}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm animate-bounce">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
