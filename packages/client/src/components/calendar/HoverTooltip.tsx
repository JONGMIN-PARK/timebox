import { Calendar, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HoverTooltipItem } from "./calendarTypes";

interface HoverTooltipProps {
  items: HoverTooltipItem[];
  anchorRect: DOMRect;
}

export default function HoverTooltip({ items, anchorRect }: HoverTooltipProps) {
  if (items.length === 0) return null;

  // Position tooltip just below the cell, centered horizontally
  const tooltipWidth = 220;
  let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
  let top = anchorRect.bottom + 4;

  // Keep within viewport
  if (left < 8) left = 8;
  if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
  // If below viewport, show above the cell
  if (top + 150 > window.innerHeight) {
    top = anchorRect.top - 4;
  }

  return (
    <div
      className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-2.5 pointer-events-none"
      style={{ left, top: top + 150 > window.innerHeight ? undefined : top, bottom: top + 150 > window.innerHeight ? (window.innerHeight - anchorRect.top + 4) : undefined, width: tooltipWidth }}
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
