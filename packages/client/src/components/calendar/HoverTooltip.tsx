import { Calendar, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HoverTooltipItem } from "./calendarTypes";

interface HoverTooltipProps {
  items: HoverTooltipItem[];
  position: { x: number; y: number };
}

export default function HoverTooltip({ items, position }: HoverTooltipProps) {
  if (items.length === 0) return null;

  const tooltipWidth = 220;
  const offset = 8;
  let left = position.x + offset;
  let top = position.y + offset;

  // Keep within viewport
  if (left + tooltipWidth > window.innerWidth - 8) left = position.x - tooltipWidth - offset;
  if (top + 150 > window.innerHeight) top = position.y - 150 - offset;
  if (left < 4) left = 4;
  if (top < 4) top = 4;

  return (
    <div
      className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-2.5 pointer-events-none"
      style={{ left, top, width: tooltipWidth }}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          {item.type === "event" ? (
            <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: item.color }} />
          ) : (
            <CheckSquare className={cn("w-3 h-3 flex-shrink-0", item.completed ? "text-green-500" : "text-amber-500")} />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs truncate", item.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white")}>
              {item.title}
            </p>
            {item.time && <p className="text-[10px] text-slate-400">{item.time}</p>}
          </div>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
        </div>
      ))}
    </div>
  );
}
