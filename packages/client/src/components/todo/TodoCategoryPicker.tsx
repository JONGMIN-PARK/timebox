import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { TODO_CATEGORIES, getCategoryInfo } from "@/stores/todoStore";

/** Same category tree as Todo list — reusable in calendar modals etc. */
export function TodoCategoryPicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const info = getCategoryInfo(value);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={cn("flex items-center gap-0.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50", compact ? "px-1 py-0" : "px-2 py-1")}>
        {!compact && <span className="text-sm">{info.icon}</span>}
        <span className={cn("text-slate-600 dark:text-slate-400", compact ? "text-[10px]" : "text-xs")}>
          {compact ? (info.parentLabel ? `${info.parentLabel} › ${info.label}` : info.label) : (info.parentLabel ? `${info.parentLabel} › ${info.label}` : info.label)}
        </span>
        <ChevronDown className={cn("text-slate-400", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="absolute z-[80] left-0 top-full mt-1 w-52 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 animate-scale-in max-h-64 overflow-y-auto">
        {TODO_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <button
              type="button"
              onClick={() => {
                if (cat.children) {
                  setExpanded(expanded === cat.id ? null : cat.id);
                } else {
                  onChange(cat.id); setOpen(false);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                value === cat.id && "bg-blue-50 dark:bg-blue-500/10",
              )}
            >
              <span>{cat.icon}</span>
              <span className="flex-1 text-left font-medium text-slate-700 dark:text-slate-300">{cat.label}</span>
              {cat.children && <ChevronRight className={cn("w-3 h-3 text-slate-400 transition-transform", expanded === cat.id && "rotate-90")} />}
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
            </button>
            {cat.children && expanded === cat.id && (
              <div className="ml-5 border-l-2 border-slate-100 dark:border-slate-700">
                {cat.children.map((sub) => (
                  <button key={sub.id} type="button" onClick={() => { onChange(sub.id); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50",
                      value === sub.id && "bg-blue-50 dark:bg-blue-500/10",
                    )}>
                    <span className="text-slate-500 dark:text-slate-400">{sub.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
          <button type="button" onClick={() => setOpen(false)} className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 text-left">{t("common.close")}</button>
        </div>
      </div>
      <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} aria-hidden />
    </div>
  );
}
