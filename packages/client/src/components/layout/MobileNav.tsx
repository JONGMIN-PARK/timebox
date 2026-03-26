import { Calendar, Clock, CheckSquare, FileBox } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "calendar", label: "달력", icon: Calendar },
  { id: "timebox", label: "타임박스", icon: Clock },
  { id: "todo", label: "투두", icon: CheckSquare },
  { id: "files", label: "파일", icon: FileBox },
];

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50">
      <div className="flex justify-around py-2">
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
