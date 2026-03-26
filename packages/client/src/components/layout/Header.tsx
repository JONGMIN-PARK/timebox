import { Plus, Menu } from "lucide-react";
import DDayChips from "@/components/dday/DDayChips";

interface HeaderProps {
  onAddClick: () => void;
}

export default function Header({ onAddClick }: HeaderProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 md:hidden">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">TB</span>
        </div>
        <span className="font-bold text-slate-900 dark:text-white">TimeBox</span>
      </div>

      {/* D-Day chips - desktop */}
      <div className="hidden md:block flex-1 overflow-x-auto">
        <DDayChips />
      </div>

      <button
        onClick={onAddClick}
        className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors"
      >
        <Plus className="w-5 h-5" />
      </button>
    </header>
  );
}
