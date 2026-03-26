import { Calendar, Clock, CheckSquare, FileBox, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", label: "달력", icon: Calendar },
  { id: "timebox", label: "타임박스", icon: Clock },
  { id: "todo", label: "투두", icon: CheckSquare },
  { id: "files", label: "파일", icon: FileBox },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { logout } = useAuthStore();

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <span className="hidden lg:block ml-3 font-bold text-lg text-slate-900 dark:text-white">
          TimeBox
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
            )}
          >
            <tab.icon className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="py-4 px-2 space-y-1 border-t border-slate-200 dark:border-slate-700">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
          <Settings className="w-5 h-5" />
          <span className="hidden lg:block">설정</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block">로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
