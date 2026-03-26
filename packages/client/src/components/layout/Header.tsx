import { Plus } from "lucide-react";
import DDayChips from "@/components/dday/DDayChips";

interface HeaderProps {
  onAddClick: () => void;
}

export default function Header({ onAddClick }: HeaderProps) {
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

      <button
        onClick={onAddClick}
        className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center"
      >
        <Plus className="w-4 h-4" />
      </button>
    </header>
  );
}
