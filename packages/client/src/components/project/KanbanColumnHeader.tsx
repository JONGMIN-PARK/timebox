import React from "react";

interface KanbanColumnHeaderProps {
  label: string;
  color: string;
  count: number;
}

const KanbanColumnHeader = React.memo(function KanbanColumnHeader({
  label,
  color,
  count,
}: KanbanColumnHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
        {label}
      </h3>
      <span className="text-[11px] text-slate-400 tabular-nums font-medium bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
        {count}
      </span>
    </div>
  );
});

export default KanbanColumnHeader;
