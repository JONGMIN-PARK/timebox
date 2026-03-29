import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { usePageVisible } from "@/lib/useVisibility";
import { getSocket } from "@/lib/socket";
import { updateAppBadge } from "@/lib/badge";
import { useAuthStore } from "@/stores/authStore";
import { fmtDateTime } from "@/lib/dateUtils";
import DDayChips from "@/components/dday/DDayChips";
import { APP_VERSION } from "@/lib/version";

interface HeaderProps {
  onInboxClick?: () => void;
  onVersionClick?: () => void;
}

export default function Header({ onInboxClick, onVersionClick }: HeaderProps) {
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadCountRef = useRef(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pageVisible = usePageVisible();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchUnread = async () => {
    const res = await api.get<{ count: number }>("/inbox/unread-count");
    if (res.success && res.data) {
      setUnreadCount(res.data.count);
      unreadCountRef.current = res.data.count;
      updateAppBadge(res.data.count);
    }
  };

  // Initial fetch + show toast if unread messages exist on login
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!pageVisible) return;
    fetchUnread().then(() => {
      // Show toast on first load if there are unread messages
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        const count = unreadCountRef.current;
        if (count > 0) {
          import("@/components/ui/Toast").then(({ showToast }) => {
            showToast("info", `읽지 않은 메시지가 ${count}개 있습니다`);
          });
        }
      }
    });
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [pageVisible]);

  // Listen for inbox read events to refresh count immediately
  useEffect(() => {
    const handler = () => fetchUnread();
    window.addEventListener("inbox-updated", handler);
    return () => window.removeEventListener("inbox-updated", handler);
  }, []);

  // Listen for socket events for instant inbox updates
  useEffect(() => {
    const socket = getSocket();
    const handler = () => fetchUnread();
    socket.on("inbox:new-message", handler);
    return () => { socket.off("inbox:new-message", handler); };
  }, []);

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/40">
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-white text-[10px] font-bold">TB</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight">TimeBox</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.displayName || user?.username}</span>
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {user?.lastLoginAt ? `최근접속 ${fmtDateTime(user.lastLoginAt)}` : ""}
          </p>
        </div>
      </div>

      <div className="hidden md:flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
        <DDayChips />
        <button onClick={onVersionClick} className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          v{APP_VERSION}
        </button>
      </div>

      {/* Offline indicator */}
      {!isOnline && (
        <span className="flex items-center gap-1 text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          오프라인
        </span>
      )}

      {/* Inbox bell */}
      <button
        onClick={onInboxClick}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Bell className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
