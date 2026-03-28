import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { usePageVisible } from "@/lib/useVisibility";
import { getSocket } from "@/lib/socket";
import DDayChips from "@/components/dday/DDayChips";

interface HeaderProps {
  onInboxClick?: () => void;
}

export default function Header({ onInboxClick }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pageVisible = usePageVisible();

  const fetchUnread = async () => {
    const res = await api.get<{ count: number }>("/inbox/unread-count");
    if (res.success && res.data) setUnreadCount(res.data.count);
  };

  useEffect(() => {
    if (!pageVisible) return;
    fetchUnread();
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
    <header className="h-12 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/40">
      <div className="flex items-center gap-3 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
          <span className="text-white text-[10px] font-bold">TB</span>
        </div>
        <span className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight">TimeBox</span>
      </div>

      <div className="hidden md:block flex-1 overflow-x-auto">
        <DDayChips />
      </div>

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
