import { Calendar, Clock, CheckSquare, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
  { id: "timebox", labelKey: "nav.timebox", icon: Clock },
  { id: "todo", labelKey: "nav.todos", icon: CheckSquare },
  { id: "scheduler", labelKey: "nav.scheduler", icon: LayoutGrid },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const { t } = useI18n();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-800/95 backdrop-blur-lg border-t border-slate-200/60 dark:border-slate-700/40 z-50 safe-bottom">
      <div className="flex justify-around py-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px] transition-all duration-200",
              activeTab === tab.id
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-500 active:scale-95",
            )}
          >
            <tab.icon className={cn("w-5 h-5", activeTab === tab.id && "stroke-[2.5]")} />
            <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
