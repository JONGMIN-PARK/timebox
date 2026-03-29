import { Calendar, Clock, CheckSquare, LayoutGrid, Settings, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const personalTabs = [
  { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
  { id: "timebox", labelKey: "nav.timebox", icon: Clock },
  { id: "todo", labelKey: "nav.todos", icon: CheckSquare },
  { id: "chat", labelKey: "nav.chat", icon: MessageCircle },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

const personalTabsWithTeam = [
  { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
  { id: "timebox", labelKey: "nav.timebox", icon: Clock },
  { id: "todo", labelKey: "nav.todos", icon: CheckSquare },
  { id: "scheduler", labelKey: "nav.scheduler", icon: LayoutGrid },
  { id: "chat", labelKey: "nav.chat", icon: MessageCircle },
  { id: "team", labelKey: "project.title", icon: Users },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const { activeProjectId, projects, setActiveProject } = useProjectStore();
  const hasTeamAccess = user?.role === 'admin' || user?.hasProjectAccess || (user?.teamGroups?.length ?? 0) > 0;

  const tabs = hasTeamAccess ? personalTabsWithTeam : personalTabs;

  const handleTabClick = (tabId: string) => {
    if (tabId === "team") {
      // If there are projects, open the first one; otherwise just switch tab
      if (projects.length > 0 && !activeProjectId) {
        setActiveProject(projects[0].id);
        onTabChange("project-dashboard");
      } else if (activeProjectId) {
        // Already in a project, just keep it
        onTabChange("project-dashboard");
      } else {
        onTabChange("calendar"); // Fallback
      }
      return;
    }
    // Clicking personal tabs should exit project view
    if (activeProjectId && tabId !== "team") {
      setActiveProject(null);
    }
    onTabChange(tabId);
  };

  const isTeamActive = activeTab.startsWith("project-") || activeTab === "team";

  return (
    <nav className="md:hidden flex-shrink-0 bg-white/90 dark:bg-slate-800/95 backdrop-blur-lg border-t border-slate-200/60 dark:border-slate-700/40 z-40 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex justify-around py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === "team" ? isTeamActive : activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl min-w-0 flex-1 transition-all duration-200",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 dark:text-slate-500 active:scale-95",
              )}
            >
              <tab.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
