import { useState, useEffect, useRef } from "react";
import { Search, Calendar, CheckSquare, Flag, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { useTodoStore } from "@/stores/todoStore";
import { useEventStore } from "@/stores/eventStore";
import { useDDayStore } from "@/stores/ddayStore";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

interface SearchResult {
  type: "todo" | "event" | "dday" | "action";
  icon: typeof Calendar;
  title: string;
  subtitle?: string;
  color: string;
  action?: () => void;
}

export default function SearchModal({ open, onClose, onNavigate }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { todos } = useTodoStore();
  const { events } = useEventStore();
  const { ddays } = useDDayStore();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const q = query.toLowerCase().trim();

  const results: SearchResult[] = [];

  if (q) {
    // Search todos
    todos.filter((td) => td.title.toLowerCase().includes(q)).slice(0, 5).forEach((td) => {
      results.push({
        type: "todo", icon: CheckSquare, title: td.title,
        subtitle: `${td.completed ? t("common.done") : t("common.active")} · ${td.category}`,
        color: td.completed ? "#10b981" : "#f59e0b",
        action: () => { onNavigate("todo"); onClose(); },
      });
    });

    // Search events
    events.filter((e) => e.title.toLowerCase().includes(q)).slice(0, 5).forEach((e) => {
      results.push({
        type: "event", icon: Calendar, title: e.title,
        subtitle: `${e.startTime.slice(0, 10)} ${e.startTime.slice(11, 16)}`,
        color: e.color || "#3b82f6",
        action: () => { onNavigate("calendar"); onClose(); },
      });
    });

    // Search D-Days
    ddays.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 3).forEach((d) => {
      results.push({
        type: "dday", icon: Flag, title: d.title,
        subtitle: `D-${d.daysLeft > 0 ? d.daysLeft : `+${Math.abs(d.daysLeft)}`}`,
        color: "#ef4444",
      });
    });
  }

  // Quick actions (always show)
  if (!q || q.length <= 1) {
    const actions: SearchResult[] = [
      { type: "action", icon: Calendar, title: t("search.goCalendar"), color: "#3b82f6", action: () => { onNavigate("calendar"); onClose(); } },
      { type: "action", icon: Clock, title: t("search.goTimebox"), color: "#8b5cf6", action: () => { onNavigate("timebox"); onClose(); } },
      { type: "action", icon: CheckSquare, title: t("search.goTodos"), color: "#f59e0b", action: () => { onNavigate("todo"); onClose(); } },
    ];
    if (!q) results.push(...actions);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIdx]?.action) { results[selectedIdx].action!(); }
    else if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 animate-overlay p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden animate-scale-in">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
          <Search className="w-5 h-5 text-slate-400" />
          <input ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none" />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.map((r, i) => (
            <button key={`${r.type}-${r.title}-${i}`}
              onClick={r.action}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                selectedIdx === i ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30",
              )}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: r.color + "15" }}>
                <r.icon className="w-4 h-4" style={{ color: r.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 dark:text-white truncate">{r.title}</p>
                {r.subtitle && <p className="text-[11px] text-slate-400 truncate">{r.subtitle}</p>}
              </div>
              {selectedIdx === i && <span className="text-[10px] text-slate-400">Enter ↵</span>}
            </button>
          ))}
          {q && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{t("search.noResults")} "{query}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
