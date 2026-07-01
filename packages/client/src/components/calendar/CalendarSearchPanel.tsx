import { useEffect, useMemo, useState } from "react";
import { Search, X, Calendar as CalIcon, CheckSquare, Repeat, ArrowDownUp } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { enUS } from "date-fns/locale";
import { eventApi } from "@/lib/apiService";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { getCategoryInfo } from "@/lib/categories";
import type { CalendarEvent, Todo } from "./calendarTypes";

type Kind = "all" | "event" | "todo";
type SortBy = "dateDesc" | "dateAsc" | "title" | "type";

/** Wrap occurrences of `q` in `text` with a highlight marker (case-insensitive). */
function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lower = query.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lower ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface EventRow {
  kind: "event";
  id: number;
  sortAt: number;
  title: string;
  memo: string;
  color: string;
  ev: CalendarEvent;
}
interface TodoRow {
  kind: "todo";
  id: number;
  sortAt: number;
  title: string;
  memo: string;
  color: string;
  completed: boolean;
  icon: string;
  td: Todo;
}
type Row = EventRow | TodoRow;

const dayLabel = (iso: string | null): string => {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "EEE, MMM d, yyyy", { locale: enUS }) : "";
};

export default function CalendarSearchPanel({
  open,
  onClose,
  todos,
  projectNameById,
  onEditEvent,
  onEditTodo,
}: {
  open: boolean;
  onClose: () => void;
  todos: Todo[];
  projectNameById: Record<number, string>;
  onEditEvent: (ev: CalendarEvent) => void;
  onEditTodo: (td: Todo) => void;
}) {
  const { t } = useI18n();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dateDesc");

  // Pull the full event set (not just the visible range) whenever the panel opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    eventApi
      .getAll()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setEvents(res.data as CalendarEvent[]);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Row[] = [];

    if (kind !== "todo") {
      for (const ev of events) {
        const memo = ev.description || "";
        if (q && !`${ev.title} ${memo}`.toLowerCase().includes(q)) continue;
        out.push({
          kind: "event",
          id: ev.id,
          sortAt: parseISO(ev.startTime).getTime() || 0,
          title: ev.title,
          memo,
          color: ev.color || "#3b82f6",
          ev,
        });
      }
    }
    if (kind !== "event") {
      for (const td of todos) {
        if (td.deletedAt) continue;
        const memo = td.memo || "";
        if (q && !`${td.title} ${memo}`.toLowerCase().includes(q)) continue;
        out.push({
          kind: "todo",
          id: td.id,
          // Undated todos sort to the very top (treated as "now"); dated by dueDate.
          sortAt: td.dueDate ? parseISO(td.dueDate).getTime() || 0 : Number.MAX_SAFE_INTEGER,
          title: td.title,
          memo,
          color: td.priority === "high" ? "#ef4444" : td.priority === "medium" ? "#f59e0b" : "#94a3b8",
          completed: td.completed,
          icon: getCategoryInfo(td.category).icon,
          td,
        });
      }
    }

    out.sort((a, b) => {
      switch (sortBy) {
        case "dateAsc":
          return a.sortAt - b.sortAt;
        case "title":
          return a.title.localeCompare(b.title);
        case "type":
          // Events first, then to-dos; each group by most recent date.
          if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
          return b.sortAt - a.sortAt;
        case "dateDesc":
        default:
          // Most recent / upcoming first; undated todos surface at the top.
          return b.sortAt - a.sortAt;
      }
    });
    return out;
  }, [events, todos, query, kind, sortBy]);

  if (!open) return null;

  const filters: { id: Kind; label: string }[] = [
    { id: "all", label: t("calendar.searchAll") },
    { id: "event", label: t("calendar.searchEvents") },
    { id: "todo", label: t("calendar.searchTodos") },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col h-full sm:h-[85vh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Search className="w-4 h-4 text-blue-500" /> {t("calendar.searchTitle")}
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label={t("common.cancel")}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("calendar.searchPlaceholder")}
              className="w-full text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label={t("common.cancel")}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setKind(f.id)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  kind === f.id
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-500",
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-slate-400">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-[11px] bg-transparent outline-none text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <option value="dateDesc">{t("calendar.sortDateDesc")}</option>
                <option value="dateAsc">{t("calendar.sortDateAsc")}</option>
                <option value="title">{t("calendar.sortTitle")}</option>
                <option value="type">{t("calendar.sortType")}</option>
              </select>
              <span className="text-[11px] tabular-nums">{rows.length}</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center text-xs text-slate-400 py-8">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Search className="w-9 h-9 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">{query.trim() ? t("calendar.searchNoResults") : t("calendar.searchEmpty")}</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => {
                const dateStr = row.kind === "event" ? dayLabel(row.ev.startTime) : dayLabel(row.td.dueDate ?? null);
                const timeStr =
                  row.kind === "event" && !row.ev.allDay
                    ? `${row.ev.startTime.slice(11, 16)}–${row.ev.endTime.slice(11, 16)}`
                    : "";
                const projName = row.kind === "event" ? (row.ev.projectId ? projectNameById[row.ev.projectId] : "") : row.td.projectId ? projectNameById[row.td.projectId] : "";
                return (
                  <li key={`${row.kind}-${row.id}`}>
                    <button
                      onClick={() => {
                        onClose();
                        if (row.kind === "event") onEditEvent(row.ev);
                        else onEditTodo(row.td);
                      }}
                      className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                    >
                      <span className="mt-0.5 shrink-0">
                        {row.kind === "event" ? (
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: row.color + "22", color: row.color }}>
                            <CalIcon className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-sm">
                            {row.icon || <CheckSquare className="w-3.5 h-3.5 text-slate-400" />}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-sm truncate",
                              row.kind === "todo" && row.completed
                                ? "line-through text-slate-400"
                                : "text-slate-900 dark:text-white",
                            )}
                          >
                            {highlight(row.title, query)}
                          </span>
                          {row.kind === "event" && row.ev.recurrenceRule && <Repeat className="w-3 h-3 text-slate-400 shrink-0" />}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-400">
                          <span className="tabular-nums">{dateStr || t("calendar.searchNoDate")}</span>
                          {timeStr && <span className="tabular-nums">{timeStr}</span>}
                          {projName && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{projName}</span>}
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {row.kind === "event" ? t("calendar.searchEvents") : t("calendar.searchTodos")}
                          </span>
                        </span>
                        {row.memo && (
                          <span className="block mt-0.5 text-[11px] text-slate-400 line-clamp-1">{highlight(row.memo, query)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
