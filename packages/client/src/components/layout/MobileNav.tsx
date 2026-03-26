import { Calendar, Clock, CheckSquare, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timebox", label: "TimeBox", icon: Clock },
  { id: "todo", label: "Todos", icon: CheckSquare },
  { id: "scheduler", label: "Scheduler", icon: LayoutGrid },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50 safe-bottom">
      <div className="flex justify-around py-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg min-w-[56px] transition-colors",
              activeTab === tab.id
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-500",
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
