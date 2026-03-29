import { useEffect, useState } from "react";
import { Calendar, Clock, CheckSquare, FileBox, Settings, LogOut, Sun, Moon, Monitor, LayoutGrid, Plus, User, Users, LayoutDashboard, ListTodo, ChevronRight, Mail, MessageCircle, BarChart3, FolderOpen, FileText, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useProjectStore } from "@/stores/projectStore";
import { useI18n } from "@/lib/useI18n";
import { usePageVisible } from "@/lib/useVisibility";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
  { id: "timebox", labelKey: "nav.timebox", icon: Clock },
  { id: "todo", labelKey: "nav.todos", icon: CheckSquare },
  { id: "files", labelKey: "nav.files", icon: FileBox },
  { id: "scheduler", labelKey: "nav.scheduler", icon: LayoutGrid },
  { id: "inbox", labelKey: "inbox.title", icon: Mail },
  { id: "chat", labelKey: "nav.chat", icon: MessageCircle },
];

const projectTabs = [
  { id: "project-dashboard", labelKey: "project.dashboard", icon: LayoutDashboard },
  { id: "project-tasks", labelKey: "project.tasks", icon: ListTodo },
  { id: "project-gantt", labelKey: "project.gantt", icon: BarChart2 },
  { id: "project-board", labelKey: "post.title", icon: FileText },
  { id: "project-files", labelKey: "nav.files", icon: FolderOpen },
  { id: "project-chat", labelKey: "nav.chat", icon: MessageCircle },
  { id: "project-members", labelKey: "project.members", icon: Users },
];

function fmtLoginTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${h}:${min}`;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { logout, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { projects, activeProjectId, setActiveProject, fetchProjects } = useProjectStore();
  const { t } = useI18n();
  const pageVisible = usePageVisible();
  const hasTeamAccess = user?.role === 'admin' || user?.hasProjectAccess || (user?.teamGroups?.length ?? 0) > 0;
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<{userId: number; displayName: string; username: string}[]>([]);

  // Send heartbeat every 60 seconds
  useEffect(() => {
    if (!user || !pageVisible) return;
    const sendHeartbeat = () => {
      api.post("/presence/heartbeat", { displayName: user.displayName, username: user.username });
    };
    sendHeartbeat(); // Initial
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [user, pageVisible]);

  // Fetch online users every 30 seconds
  useEffect(() => {
    if (!hasTeamAccess || !pageVisible) return;
    const fetchOnline = async () => {
      const res = await api.get<{userId: number; displayName: string; username: string}[]>("/presence/online");
      if (res.success && res.data) setOnlineUsers(res.data);
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30000);
    return () => clearInterval(interval);
  }, [hasTeamAccess, pageVisible]);

  const toggleGroup = (groupId: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  useEffect(() => {
    if (hasTeamAccess) fetchProjects();
  }, [fetchProjects, hasTeamAccess]);

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-[220px] bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm border-r border-slate-200/80 dark:border-slate-700/60">
      {/* Logo + User info */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-600/20 flex-shrink-0">
          <Clock className="w-[18px] h-[18px] text-white" />
        </div>
        <div className="hidden lg:block min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[15px] text-slate-900 dark:text-white tracking-tight">TimeBox</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.displayName || user?.username}</span>
          </div>
          <p className="text-[9px] text-slate-400 truncate">
            {user?.lastLoginAt ? `최근접속 ${fmtLoginTime(user.lastLoginAt)}` : ""}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {/* Personal nav items or project nav items */}
        {activeProjectId ? (
          <>
            <button
              onClick={() => setActiveProject(null)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-all duration-200"
            >
              <User className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="hidden lg:block">{t("project.backToPersonal")}</span>
            </button>
            <div className="hidden lg:block px-3 py-1.5">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                {projects.find(p => p.id === activeProjectId)?.name}
              </p>
            </div>
            {projectTabs.map((tab) => (
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
                <span className="hidden lg:block">{t(tab.labelKey)}</span>
              </button>
            ))}
          </>
        ) : (
          tabs.map((tab) => (
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
              <span className="hidden lg:block">{t(tab.labelKey)}</span>
            </button>
          ))
        )}

        {hasTeamAccess && (
          <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-700/40">
            <div className="hidden lg:flex items-center justify-between px-3 pb-1.5">
              <button
                onClick={() => { setActiveProject(null); onTabChange("projects"); }}
                className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-blue-500 transition-colors"
              >
                {t("project.title")} ▸
              </button>
            </div>
            {/* Team group accordion sections */}
            {user?.teamGroups && user.teamGroups.length > 0 && (
              user.teamGroups.map((group) => {
                const groupProjects = projects.filter(p => p.teamGroupId === group.id && !p.archived);
                const isOpen = openGroups.has(group.id);
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 rounded-lg transition-all"
                    >
                      <ChevronRight className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")} />
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="hidden lg:block truncate">{group.name}</span>
                      <span className="hidden lg:block text-[10px] text-slate-400 ml-auto">{groupProjects.length}</span>
                    </button>
                    {isOpen && groupProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => { setActiveProject(project.id); onTabChange("project-dashboard"); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-1.5 pl-8 rounded-xl text-[13px] font-medium transition-all duration-200",
                          activeProjectId === project.id
                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 hover:text-slate-700 dark:hover:text-slate-300",
                        )}
                      >
                        <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color || "#3b82f6" }} />
                        </span>
                        <span className="hidden lg:block truncate">{project.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
            {/* Ungrouped projects (teamGroupId is null) — always show */}
            {projects.filter(p => !p.teamGroupId && !p.archived).map((project) => (
              <button
                key={project.id}
                onClick={() => { setActiveProject(project.id); onTabChange("project-dashboard"); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200",
                  activeProjectId === project.id
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 hover:text-slate-700 dark:hover:text-slate-300",
                )}
              >
                <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color || "#3b82f6" }} />
                </span>
                <span className="hidden lg:block truncate">{project.name}</span>
              </button>
            ))}
            {user?.role === 'admin' && (
              <button
                onClick={() => onTabChange("project-new")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-400 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200"
              >
                <Plus className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="hidden lg:block">{t("project.new")}</span>
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Online team members */}
      {hasTeamAccess && onlineUsers.length > 0 && (
        <div className="px-2 py-2 border-t border-slate-200/60 dark:border-slate-700/40">
          <div className="hidden lg:block px-3 pb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Online ({onlineUsers.filter(u => u.userId !== user?.id).length})
            </span>
          </div>
          <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
            {onlineUsers.filter(u => u.userId !== user?.id).map((u) => (
              <div key={u.userId} className="flex items-center gap-2 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="hidden lg:block text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {u.displayName || u.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="py-3 px-2 space-y-0.5 border-t border-slate-200/60 dark:border-slate-700/40">
        <button onClick={cycleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40 transition-all">
          <ThemeIcon className="w-[18px] h-[18px]" />
          <span className="hidden lg:block">{{ light: t("settings.light"), dark: t("settings.dark"), system: t("settings.system") }[theme]}</span>
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => onTabChange("analytics")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all",
              activeTab === "analytics"
                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/40",
            )}
          >
            <BarChart3 className="w-[18px] h-[18px]" />
            <span className="hidden lg:block">{t("nav.analytics")}</span>
          </button>
        )}
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
          <span className="hidden lg:block">{t("nav.settings")}</span>
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
          <span className="hidden lg:block">{t("auth.signOut")}</span>
        </button>
      </div>
    </aside>
  );
}
