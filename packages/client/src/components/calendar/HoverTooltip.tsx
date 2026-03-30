import { Calendar, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HoverTooltipItem } from "./calendarTypes";

interface HoverTooltipProps {
  items: HoverTooltipItem[];
}

export default function HoverTooltip({ items }: HoverTooltipProps) {
  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded border border-slate-200 dark:border-slate-600 shadow-lg p-1.5 overflow-y-auto pointer-events-none">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          {item.type === "event" ? (
            <Calendar className="w-2.5 h-2.5 flex-shrink-0" style={{ color: item.color }} />
          ) : (
            <CheckSquare className={cn("w-2.5 h-2.5 flex-shrink-0", item.completed ? "text-green-500" : "text-amber-500")} />
          )}
          <div className="min-w-0 flex-1 flex items-center gap-0.5">
            {item.type === "todo" && item.categoryIcon && (
              <span className="shrink-0 text-[9px] leading-none select-none" aria-hidden>{item.categoryIcon}</span>
            )}
            <p className={cn("text-[9px] leading-tight truncate min-w-0", item.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white")}>
              {item.title}
            </p>
            {item.time && <p className="text-[8px] leading-tight text-slate-400">{item.time}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
