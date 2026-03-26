import { Calendar, Clock, CheckSquare, FileBox, Settings, LogOut, Sun, Moon, Monitor, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timebox", label: "TimeBox", icon: Clock },
  { id: "todo", label: "Todos", icon: CheckSquare },
  { id: "files", label: "Files", icon: FileBox },
  { id: "scheduler", label: "Scheduler", icon: LayoutGrid },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { logout, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-[220px] bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm border-r border-slate-200/80 dark:border-slate-700/60">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-600/20">
          <Clock className="w-[18px] h-[18px] text-white" />
        </div>
        <span className="hidden lg:block ml-3 font-semibold text-[15px] text-slate-900 dark:text-white tracking-tight">
          TimeBox
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <tab.icon className={cn("w-[18px] h-[18px] flex-shrink-0", activeTab === tab.id && "stroke-[2.5]")} />
            <span className="hidden lg:block">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="py-3 px-2 space-y-0.5 border-t border-slate-200/60 dark:border-slate-700/40">
        <button onClick={cycleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-all">
          <ThemeIcon className="w-[18px] h-[18px]" />
          <span className="hidden lg:block">{{ light: "Light", dark: "Dark", system: "System" }[theme]}</span>
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all",
            activeTab === "settings"
              ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40",
          )}
        >
          <Settings className="w-[18px] h-[18px]" />
          <span className="hidden lg:block">Settings</span>
        </button>

        {/* User avatar */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[11px] font-semibold text-white shadow-sm">
            {(user?.displayName || user?.username || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{user?.displayName || user?.username}</p>
            <p className="text-[10px] text-slate-400 truncate">@{user?.username}</p>
          </div>
        </div>

        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-400 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/10 transition-all">
          <LogOut className="w-[18px] h-[18px]" />
          <span className="hidden lg:block">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
