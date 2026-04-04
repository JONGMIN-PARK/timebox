import { useEffect, useState, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { usePageVisible } from "@/lib/useVisibility";
import { useSocketEvent } from "@/lib/SocketProvider";
import { updateAppBadge } from "@/lib/badge";
import { useAuthStore } from "@/stores/authStore";
import { fmtDateTime } from "@/lib/dateUtils";
import DDayChips from "@/components/dday/DDayChips";
import WeekSummaryChip from "@/components/layout/WeekSummaryChip";
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
    // Fallback polling at 2-min interval in case socket events are missed
    const interval = setInterval(fetchUnread, 120000);
    return () => clearInterval(interval);
  }, [pageVisible]);

  // Listen for inbox read events to refresh count immediately (local browser events)
  useEffect(() => {
    const handler = () => fetchUnread();
    window.addEventListener("inbox-updated", handler);
    return () => window.removeEventListener("inbox-updated", handler);
  }, []);

  // Listen for socket events for instant inbox updates (replaces 30s polling)
  useSocketEvent("inbox:new-message", useCallback(() => fetchUnread(), []));
  useSocketEvent("inbox:update", useCallback(() => fetchUnread(), []));

  return (
    <header className="relative h-12 flex-shrink-0 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
      {/* Top gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-500/30 via-blue-400/30 to-transparent" />
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
        <WeekSummaryChip />
        <button onClick={onVersionClick} className="text-[8px] text-slate-400 bg-slate-100/70 dark:bg-slate-700/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/30 px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 hover:scale-105 active:scale-95 transition-all duration-200">
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
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Inbox"
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
