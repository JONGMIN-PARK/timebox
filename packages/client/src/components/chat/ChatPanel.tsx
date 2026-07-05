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
  Lock,
  Compass,
  UserPlus,
  Reply,
  Settings,
  X,
  Trash2,
  Trash,
  RotateCcw,
  Smile,
  Paperclip,
  FileText,
  Download,
  Loader2,
} from "lucide-react";

// Max shareable file size (2GB), mirrors the server MAX_FILE_SIZE cap.
const MAX_CHAT_FILE = 2 * 1024 * 1024 * 1024;
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

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
  visibility?: "public" | "private";
  lastMessage?: LastMessage | null;
  memberCount: number;
  createdBy?: number;
  deletedAt?: string | null;
}

interface PublicRoom {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
}

interface RoomInvite {
  id: number;
  roomId: number;
  roomName: string;
  invitedBy: number;
  inviterName: string;
  createdAt: string;
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

type View = "rooms" | "chat" | "create" | "trash" | "browse";

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
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Emoji picker state
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Create room state
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomVisibility, setRoomVisibility] = useState<"public" | "private">("private");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(),
  );
  const [creating, setCreating] = useState(false);

  // Public-room browsing + invitations (방문 / 초대)
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [invitingRoom, setInvitingRoom] = useState<ChatRoom | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());

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

  // ── Public rooms (방문) + invitations (초대) ──
  const fetchPublicRooms = useCallback(async () => {
    const res = await api.get<PublicRoom[]>("/chat/public");
    if (res.success && res.data) setPublicRooms(res.data);
  }, []);

  const fetchInvites = useCallback(async () => {
    const res = await api.get<RoomInvite[]>("/chat/invites");
    if (res.success && res.data) setInvites(res.data);
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const joinPublicRoom = useCallback(async (room: PublicRoom) => {
    const res = await api.post(`/chat/${room.id}/join`, {});
    if (res.success) {
      setPublicRooms((prev) => prev.filter((r) => r.id !== room.id));
      await fetchRooms();
      showToast("success", t("chat.joined") || "참여했습니다");
    }
  }, [fetchRooms, t]);

  const acceptInvite = useCallback(async (inv: RoomInvite) => {
    const res = await api.post(`/chat/invites/${inv.roomId}/accept`, {});
    if (res.success) {
      setInvites((prev) => prev.filter((i) => i.roomId !== inv.roomId));
      await fetchRooms();
      showToast("success", t("chat.joined") || "참여했습니다");
    }
  }, [fetchRooms, t]);

  const declineInvite = useCallback(async (inv: RoomInvite) => {
    const res = await api.post(`/chat/invites/${inv.roomId}/decline`, {});
    if (res.success) setInvites((prev) => prev.filter((i) => i.roomId !== inv.roomId));
  }, []);

  const inviteUser = useCallback(async (roomId: number, targetId: number) => {
    const res = await api.post(`/chat/${roomId}/invite`, { userId: targetId });
    if (res.success) {
      setInvitedIds((prev) => new Set(prev).add(targetId));
      showToast("success", t("chat.inviteSent") || "초대했습니다");
    } else {
      showToast("error", res.error || (t("chat.inviteFailed") || "초대 실패"));
    }
  }, [t]);

  // Realtime: someone invited me to a room.
  useSocketEvent("chat:invited", useCallback(() => {
    fetchInvites();
    showToast("info", t("chat.inviteReceived") || "새 채팅방 초대가 도착했습니다");
  }, [fetchInvites, t]));

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

  // ── File sharing (up to 2GB) ──

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !activeRoom) return;
    if (file.size > MAX_CHAT_FILE) {
      showToast("error", t("chat.fileTooLarge") || "파일이 너무 큽니다 (최대 2GB)");
      return;
    }
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tags", JSON.stringify(["chat"]));
      const token = localStorage.getItem("timebox_token");
      const resp = await fetch("/api/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || "upload failed");
      }
      const uploaded = (await resp.json()).data;
      // Encode file metadata into the message content (type "file").
      const payload = JSON.stringify({
        fileId: uploaded.id,
        storedName: uploaded.storedName,
        name: uploaded.originalName,
        size: uploaded.size,
        mime: uploaded.mimeType,
      });
      const res = await api.post<ChatMessage>(`/chat/${activeRoom.id}/messages`, { content: payload, type: "file" });
      if (res.success && res.data) {
        setMessages(prev => [...prev, res.data!]);
        socket?.emit("chat:message", { roomId: String(activeRoom.id), message: res.data });
      }
    } catch (err) {
      showToast("error", (err as Error).message?.includes("not allowed")
        ? (t("chat.fileTypeBlocked") || "지원하지 않는 파일 형식입니다")
        : (t("chat.uploadFailed") || "업로드 실패"));
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadSharedFile = (storedName: string, name: string) => {
    const token = localStorage.getItem("timebox_token");
    fetch(`/api/files/shared/${storedName}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(() => showToast("error", t("chat.downloadFailed") || "다운로드 실패"));
  };

  // Parse a "file"-type message's JSON content.
  const parseFileContent = (content: string): { fileId: number; storedName: string; name: string; size: number; mime: string } | null => {
    try { return JSON.parse(content); } catch { return null; }
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
    setRoomVisibility("private");
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
    if (!roomName.trim()) return;
    setCreating(true);

    const res = await api.post<ChatRoom>("/chat", {
      name: roomName.trim(),
      description: roomDescription.trim() || null,
      visibility: roomVisibility,
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
    r.type === "image" ? "📷 사진"
    : r.type === "file" ? `📎 ${parseFileContent(r.content)?.name || "파일"}`
    : (r.content || t("chat.deletedMessage"));

  // Short preview for the room list's last-message line.
  const lastMessagePreview = (m: LastMessage) =>
    m.type === "image" ? "📷 사진"
    : m.type === "file" ? `📎 ${parseFileContent(m.content)?.name || "파일"}`
    : m.content;

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
            onClick={() => { setView("browse"); fetchPublicRooms(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            title={t("chat.browse") || "공개방 둘러보기"}
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
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
        {/* Received invitations (초대) */}
        {invites.length > 0 && (
          <div className="border-b border-slate-100 dark:border-slate-700/50 bg-blue-50/40 dark:bg-blue-900/10">
            <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {t("chat.invitations") || "받은 초대"} ({invites.length})
            </p>
            {invites.map((inv) => (
              <div key={inv.roomId} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{inv.roomName}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {inv.inviterName}{t("chat.invitedYou") || "님이 초대했습니다"}
                  </p>
                </div>
                <button onClick={() => acceptInvite(inv)} className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500">
                  {t("chat.accept") || "수락"}
                </button>
                <button onClick={() => declineInvite(inv)} className="shrink-0 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                  {t("chat.decline") || "거절"}
                </button>
              </div>
            ))}
          </div>
        )}
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
                    {room.type === "group" && room.visibility === "public" && (
                      <Globe className="shrink-0 w-3 h-3 text-blue-400" aria-label={t("chat.public") || "공개"} />
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                    {formatRoomTime(room.lastMessage?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-slate-400 truncate">
                    {room.lastMessage ? lastMessagePreview(room.lastMessage) : "No messages yet"}
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
            "absolute z-20 bottom-full mb-1 flex items-center gap-1 px-2 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-600",
            isMe ? "right-0" : "left-0",
          )}>
            {REACTION_EMOJIS.map((e) => (
              <button key={e} onClick={() => toggleReaction(msg.id, e)} className="w-8 h-8 flex items-center justify-center text-xl leading-none hover:scale-125 transition-transform">
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

  const openInvite = async (room: ChatRoom) => {
    setInvitingRoom(room);
    setInvitedIds(new Set());
    if (allUsers.length === 0) {
      const res = await api.get<ChatUser[]>("/inbox/users");
      if (res.success && res.data) setAllUsers(res.data);
    }
  };

  // Invite-user modal: pick users to invite to the current room.
  const renderInviteModal = () => {
    if (!invitingRoom) return null;
    return (
      <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setInvitingRoom(null)}>
        <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center gap-2 min-w-0">
              <UserPlus className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {t("chat.inviteTo") || "초대"} · {invitingRoom.name}
              </h3>
            </div>
            <button onClick={() => setInvitingRoom(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allUsers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>
            ) : (
              allUsers.map((u) => {
                const invited = invitedIds.has(u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {getInitial(u.displayName || u.username)}
                    </div>
                    <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">{u.displayName || u.username}</span>
                    <button
                      onClick={() => inviteUser(invitingRoom.id, u.id)}
                      disabled={invited}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium",
                        invited
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-400"
                          : "bg-blue-600 text-white hover:bg-blue-500",
                      )}
                    >
                      {invited ? (t("chat.invited") || "초대됨") : (t("chat.invite") || "초대")}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

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
          {activeRoom.type !== "direct" && (
            <button
              onClick={() => openInvite(activeRoom)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              title={t("chat.invite") || "초대"}
            >
              <UserPlus className="w-4 h-4 text-slate-400" />
            </button>
          )}
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

              // File message (shared file, up to 2GB)
              if (msg.type === "file") {
                const f = parseFileContent(msg.content);
                return withDivider(
                  <div
                    key={msg.id}
                    className={cn("flex flex-col group", isMe ? "items-end" : "items-start", showHeader ? "mt-3" : "mt-0.5")}
                  >
                    {showHeader && !isMe && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{getInitial(msg.senderName)}</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{msg.senderName}</span>
                      </div>
                    )}
                    <div className={cn("flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
                      <button
                        onClick={() => f && downloadSharedFile(f.storedName, f.name)}
                        className={cn(
                          "flex items-center gap-2.5 max-w-[80%] px-3 py-2.5 rounded-2xl text-left transition-colors",
                          isMe ? "bg-blue-600 text-white rounded-br-md hover:bg-blue-500" : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md hover:bg-slate-200 dark:hover:bg-slate-600",
                        )}
                      >
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", isMe ? "bg-white/20" : "bg-blue-100 dark:bg-blue-900/40")}>
                          <FileText className={cn("w-4.5 h-4.5", isMe ? "text-white" : "text-blue-600 dark:text-blue-300")} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{f?.name || "file"}</p>
                          <p className={cn("text-[11px] flex items-center gap-1", isMe ? "text-white/70" : "text-slate-400")}>
                            <Download className="w-3 h-3" />{f ? formatBytes(f.size) : ""}
                          </p>
                        </div>
                      </button>
                      {renderMsgActions(msg, isMe)}
                    </div>
                    {renderReactionChips(msg, isMe)}
                    <span className={cn("text-[9px] text-slate-400 mt-0.5", isMe ? "mr-1" : "ml-1")}>{formatTime(msg.createdAt)}</span>
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

            {/* File attach (up to 2GB) */}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="p-2 rounded-xl transition-colors bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex-shrink-0 disabled:opacity-60"
              title={t("chat.attachFile") || "파일 첨부"}
            >
              {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>

            {/* Emoji picker */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={() => setShowEmoji(prev => !prev)}
                className="p-2 rounded-xl transition-colors bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex-shrink-0"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full mb-2 right-0 p-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 max-w-[calc(100vw-2rem)]">
                  {/* Explicit min track width (2.75rem) so the columns can't collapse to
                      zero inside this shrink-to-fit popover, which was overlapping the emojis. */}
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, 2.75rem)" }}>
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="w-11 h-11 flex items-center justify-center text-[26px] leading-none rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-90 transition-transform"
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

        {/* Visibility: public (browse & join) vs private (invite-only) */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {t("chat.visibility") || "공개 범위"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setRoomVisibility(v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
                  roomVisibility === v
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                )}
              >
                {v === "public" ? <Globe className="w-4 h-4 text-blue-500 shrink-0" /> : <Lock className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    {v === "public" ? (t("chat.public") || "공개") : (t("chat.private") || "비공개")}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {v === "public" ? (t("chat.publicHint") || "누구나 참여") : (t("chat.privateHint") || "초대 전용")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Member selection */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {t("chat.membersOptional") || "멤버"} ({selectedUserIds.size})
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
          disabled={!roomName.trim() || creating}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          {creating ? t("common.loading") : "Create Room"}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  BROWSE PUBLIC ROOMS VIEW (방문)
  // ══════════════════════════════════════════

  const renderBrowse = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <button onClick={() => setView("rooms")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Compass className="w-4 h-4 text-slate-500" />
        <h2 className="font-semibold text-[15px] text-slate-900 dark:text-white">{t("chat.browse") || "공개방 둘러보기"}</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {publicRooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Compass className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{t("chat.noPublicRooms") || "참여할 수 있는 공개방이 없습니다"}</p>
          </div>
        ) : (
          publicRooms.map((room) => (
            <div key={room.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{room.name}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {room.description || `${room.memberCount} ${t("chat.membersOptional") || "멤버"}`}
                </p>
              </div>
              <button
                onClick={() => joinPublicRoom(room)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500"
              >
                {t("chat.join") || "참여"}
              </button>
            </div>
          ))
        )}
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
      {view === "browse" && renderBrowse()}
      {view === "trash" && renderTrash()}
      {invitingRoom && renderInviteModal()}

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
