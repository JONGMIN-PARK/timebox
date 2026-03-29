import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { useTodoStore, TODO_CATEGORIES, getCategoryInfo, type Todo } from "@/stores/todoStore";
import { TodoCategoryPicker } from "@/components/todo/TodoCategoryPicker";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Circle, CheckCircle2, ChevronDown, ChevronRight, GripVertical, CalendarDays, Pencil, Search, Clock, Play, RotateCcw } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/lib/useI18n";

// ── Helpers ──
function getEffectiveStatus(todo: Todo): 'waiting' | 'active' | 'completed' {
  if (todo.status) return todo.status;
  return todo.completed ? 'completed' : 'active';
}

function isTrashed(todo: Todo): boolean {
  return Boolean(todo.deletedAt);
}

function getDaysLeft(d: string | null): number | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d.includes("T") ? d : d + "T00:00"); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function daysLeftLabel(d: number | null) { if (d === null) return ""; return d === 0 ? "D-Day" : d > 0 ? `D-${d}` : `D+${Math.abs(d)}`; }
function daysLeftColor(d: number | null) { if (d === null) return ""; if (d === 0) return "text-red-500 font-bold"; if (d <= 3) return "text-orange-500"; if (d <= 7) return "text-amber-500"; if (d < 0) return "text-slate-400"; return "text-slate-500"; }
const priorityDot = (p: string) => p === "high" ? "bg-red-500" : p === "medium" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600";

type TodoPriority = "high" | "medium" | "low";

function normalizePriority(p: string): TodoPriority {
  if (p === "high" || p === "low") return p;
  return "medium";
}

// ── Priority (click dot to change) ──
function PriorityDropdown({ currentPriority, onChangePriority }: { currentPriority: string; onChangePriority: (p: TodoPriority) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const norm = normalizePriority(currentPriority);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        title={t("scheduler.priority")}
        onClick={() => setOpen(!open)}
        className="w-5 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("w-2 h-2 rounded-full ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-800 ring-slate-300/80 dark:ring-slate-600", priorityDot(norm))} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-0.5 z-40 w-32 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 animate-scale-in">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChangePriority(p); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                norm === p && "bg-slate-100 dark:bg-slate-700/60 font-medium",
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", priorityDot(p))} />
              <span className="text-slate-700 dark:text-slate-300">{t(`todo.priority.${p}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status Dropdown ──
function StatusDropdown({ currentStatus, onChangeStatus }: { currentStatus: 'waiting' | 'active' | 'completed'; onChangeStatus: (status: 'waiting' | 'active' | 'completed') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const statusIcon = currentStatus === 'waiting'
    ? <Clock className="w-4 h-4 text-amber-500" />
    : currentStatus === 'completed'
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <Circle className="w-4 h-4 text-blue-500 hover:text-blue-600" />;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(!open)} className="w-6 h-7 flex items-center justify-center rounded active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors">
        {statusIcon}
      </button>
      {open && (
        <div className="absolute left-7 top-0 z-40 w-32 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 animate-scale-in">
          {([
            { status: 'waiting' as const, icon: <Clock className="w-3.5 h-3.5 text-amber-500" />, label: t("todo.waiting") },
            { status: 'active' as const, icon: <Circle className="w-3.5 h-3.5 text-blue-500" />, label: t("todo.active") },
            { status: 'completed' as const, icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />, label: t("todo.done") },
          ]).map((opt) => (
            <button key={opt.status}
              onClick={() => { onChangeStatus(opt.status); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                currentStatus === opt.status && "bg-slate-100 dark:bg-slate-700/60 font-medium",
              )}>
              {opt.icon}
              <span className="text-slate-700 dark:text-slate-300">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sortable Todo Item ──
function SortableTodoItem({ todo, onStatusChange, onDelete, onUpdateDate, onUpdateTitle, onUpdateCategory, onUpdateProgress, onUpdatePriority }: {
  todo: Todo; onStatusChange: (id: number, status: 'waiting' | 'active' | 'completed') => void; onDelete: (id: number) => void;
  onUpdateDate: (id: number, date: string) => void; onUpdateTitle: (id: number, title: string) => void;
  onUpdateCategory: (id: number, cat: string) => void; onUpdateProgress: (id: number, progress: number) => void;
  onUpdatePriority: (id: number, priority: TodoPriority) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const daysLeft = getDaysLeft(todo.dueDate);
  const catInfo = getCategoryInfo(todo.category);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const effectiveStatus = getEffectiveStatus(todo);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== todo.title) onUpdateTitle(todo.id, editTitle.trim());
    else setEditTitle(todo.title);
    setIsEditing(false);
  };

  return (
    <li ref={setNodeRef} style={style}
      className={cn(
        "group relative px-2 sm:px-3 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors",
        isDragging && "opacity-40 shadow-lg rounded-xl bg-white dark:bg-slate-800",
        effectiveStatus === 'waiting' && "border-l-2 border-amber-400 dark:border-amber-500",
      )}>
      <div className="flex items-start gap-1">
        {/* Drag handle */}
        <button {...attributes} {...listeners} className="flex-shrink-0 w-6 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none rounded">
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        </button>

        {/* Status */}
        <StatusDropdown currentStatus={effectiveStatus} onChangeStatus={(s) => onStatusChange(todo.id, s)} />

        <PriorityDropdown currentPriority={todo.priority} onChangePriority={(p) => onUpdatePriority(todo.id, p)} />

        {/* Content */}
        <div className="flex-1 min-w-0 pr-14">
          {/* Title */}
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle} onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setEditTitle(todo.title); setIsEditing(false); } }}
                className="flex-1 text-[13px] bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40" autoFocus />
            ) : (
              <span className="text-[13px] text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 leading-snug"
                onDoubleClick={() => { setIsEditing(true); setEditTitle(todo.title); }}>{todo.title}</span>
            )}
          </div>

          {/* Meta: category · date · D-Day */}
          <div className="flex items-center gap-1.5 mt-1 ml-3 text-[10px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-0.5 shrink-0">
              <span>{catInfo.icon}</span>
              <TodoCategoryPicker value={todo.category} onChange={(cat) => onUpdateCategory(todo.id, cat)} compact />
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <button onClick={() => setShowDatePicker(!showDatePicker)}
              className={cn("flex items-center gap-0.5 shrink-0 hover:text-blue-500 transition-colors", daysLeft !== null ? daysLeftColor(daysLeft) : "")}>
              <CalendarDays className="w-2.5 h-2.5" />
              {todo.dueDate ? <span>{todo.dueDate.slice(5, 10)}{todo.dueDate.includes("T") ? ` ${todo.dueDate.slice(11, 16)}` : ""}</span>
                : <span>date</span>}
            </button>
            {daysLeft !== null && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className={cn("font-semibold shrink-0", daysLeftColor(daysLeft))}>{daysLeftLabel(daysLeft)}</span>
              </>
            )}
          </div>

          {/* Waiting: quick start / complete; else progress bar */}
          {effectiveStatus === 'waiting' ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-3">
              <button
                type="button"
                onClick={() => onStatusChange(todo.id, "active")}
                title={t("todo.active")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 dark:hover:bg-blue-500/25 transition-colors"
              >
                <Play className="w-3 h-3 shrink-0 fill-current" />
                {t("todo.waitingStart")}
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(todo.id, "completed")}
                title={t("todo.done")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200/80 hover:bg-green-100 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30 dark:hover:bg-green-500/25 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                {t("todo.waitingComplete")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-3">
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <input
                  type="range"
                  min={0} max={100} step={10}
                  value={todo.progress ?? 0}
                  onChange={(e) => onUpdateProgress(todo.id, Number(e.target.value))}
                  className="flex-1 h-1.5 accent-blue-500 cursor-pointer appearance-none bg-slate-200/80 dark:bg-slate-700 rounded-full [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right shrink-0">{todo.progress ?? 0}%</span>
              </div>
              <button
                type="button"
                onClick={() => onStatusChange(todo.id, "waiting")}
                title={t("todo.waiting")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30 dark:hover:bg-amber-500/25 transition-colors shrink-0"
              >
                <Clock className="w-3 h-3 shrink-0" />
                {t("todo.moveToWaiting")}
              </button>
            </div>
          )}

          {showDatePicker && (
            <div className="mt-1.5 ml-3 flex items-center gap-2">
              <input type="date" value={(todo.dueDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const time = (todo.dueDate || "").includes("T") ? (todo.dueDate || "").slice(10) : "";
                  onUpdateDate(todo.id, e.target.value + time);
                  if (!time) setShowDatePicker(false);
                }}
                className="text-xs bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40" autoFocus />
              <input type="time" value={(todo.dueDate || "").includes("T") ? (todo.dueDate || "").slice(11, 16) : ""}
                onChange={(e) => {
                  const dateStr = (todo.dueDate || new Date().toISOString()).slice(0, 10);
                  if (e.target.value) {
                    onUpdateDate(todo.id, `${dateStr}T${e.target.value}`);
                  } else {
                    onUpdateDate(todo.id, dateStr);
                  }
                }}
                className="text-xs bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40" />
              <button onClick={() => setShowDatePicker(false)} className="text-xs text-slate-400 hover:text-slate-600 px-1">✓</button>
            </div>
          )}
        </div>

        {/* Action buttons — absolutely positioned to avoid overlap */}
        <div className="absolute right-2 top-2 flex items-center gap-0.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {!isEditing && (
            <button onClick={() => { setIsEditing(true); setEditTitle(todo.title); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button type="button" onClick={() => onDelete(todo.id)} title={t("todo.moveToTrash")}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Memoized Completed Todo Item ──
const CompletedTodoItem = memo(function CompletedTodoItem({
  todo, onRestore, onMoveToWaiting, onDelete,
}: {
  todo: Todo;
  onRestore: (id: number) => void;
  onMoveToWaiting: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useI18n();
  const catInfo = getCategoryInfo(todo.category);
  return (
    <li className="group flex items-center gap-2 px-4 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
      <div className="w-4" />
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onMoveToWaiting(todo.id)}
          title={t("todo.moveToWaiting")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:bg-amber-50 dark:active:bg-amber-900/25 transition-colors"
        >
          <Clock className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => onRestore(todo.id)}
          title={t("todo.active")}
          className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-green-50 dark:active:bg-green-900/20 transition-colors"
        >
          <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-slate-400 line-through truncate block">{todo.title}</span>
        <span className="text-[10px] text-slate-400">{catInfo.icon} {catInfo.parentLabel ? `${catInfo.parentLabel} › ${catInfo.label}` : catInfo.label}</span>
      </div>
      <button type="button" onClick={() => onDelete(todo.id)} title={t("todo.moveToTrash")}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-3 h-3 text-slate-400 hover:text-amber-600" />
      </button>
    </li>
  );
});

// ── Trashed (soft-deleted) row ──
const TrashedTodoItem = memo(function TrashedTodoItem({
  todo, onRestore, onPermanentDelete,
}: {
  todo: Todo;
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
}) {
  const { t } = useI18n();
  const catInfo = getCategoryInfo(todo.category);
  const st = getEffectiveStatus(todo);
  const statusLabel = st === "waiting" ? t("todo.waiting") : st === "completed" ? t("todo.done") : t("todo.active");
  return (
    <li className="group flex items-center gap-2 px-4 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors border-l-2 border-slate-300/80 dark:border-slate-600">
      <Trash2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-slate-600 dark:text-slate-300 truncate block">{todo.title}</span>
        <span className="text-[10px] text-slate-400">
          {catInfo.icon} {catInfo.parentLabel ? `${catInfo.parentLabel} › ${catInfo.label}` : catInfo.label}
          <span className="text-slate-300 dark:text-slate-600 mx-1">·</span>
          {statusLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRestore(todo.id)}
        title={t("todo.restore")}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onPermanentDelete(todo.id)}
        title={t("todo.deletePermanently")}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
});

// ── Main TodoList ──
export default function TodoList() {
  const { todos, filter, categoryFilter, loading, setFilter, setCategoryFilter, fetchTodos, addTodo, toggleTodo, deleteTodo, restoreTodo, permanentlyDeleteTodo, emptyTrash, updateTodo, updateStatus, reorderTodos } = useTodoStore();
  const { t } = useI18n();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState("personal");
  const [newAsWaiting, setNewAsWaiting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showWaiting, setShowWaiting] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const matchesSearch = useCallback((t: Todo) =>
    !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()),
    [searchQuery]);

  // Active lists: exclude soft-deleted
  const filtered = useMemo(() =>
    todos.filter((t) => {
      if (isTrashed(t)) return false;
      if (categoryFilter && !t.category.startsWith(categoryFilter)) return false;
      return true;
    }), [todos, categoryFilter]);

  const trashedFiltered = useMemo(() =>
    todos.filter((t) => {
      if (!isTrashed(t)) return false;
      if (categoryFilter && !t.category.startsWith(categoryFilter)) return false;
      return true;
    }).filter((t) => matchesSearch(t)),
    [todos, categoryFilter, matchesSearch]);

  const waitingTodos = useMemo(() =>
    filtered.filter((t) => getEffectiveStatus(t) === 'waiting' && matchesSearch(t)),
    [filtered, matchesSearch]);

  const activeTodos = useMemo(() =>
    filtered.filter((t) => getEffectiveStatus(t) === 'active' && matchesSearch(t)).sort((a, b) => a.sortOrder - b.sortOrder),
    [filtered, matchesSearch]);

  const completedTodos = useMemo(() =>
    filtered.filter((t) => getEffectiveStatus(t) === 'completed' && matchesSearch(t)),
    [filtered, matchesSearch]);

  const completionRate = useMemo(() => {
    const nonWaiting = filtered.filter(t => getEffectiveStatus(t) !== 'waiting');
    if (nonWaiting.length === 0) return 0;
    const totalProgress = nonWaiting.reduce((sum, t) => sum + (t.completed ? 100 : (t.progress ?? 0)), 0);
    return Math.round(totalProgress / nonWaiting.length);
  }, [filtered]);

  const nonWaitingCount = useMemo(() => filtered.filter(t => getEffectiveStatus(t) !== 'waiting').length, [filtered]);
  const completedCount = completedTodos.length;
  const waitingCount = waitingTodos.length;

  // Category counts for filter
  const categoryCounts = useMemo(() =>
    todos.reduce((acc, t) => {
      if (isTrashed(t)) return acc;
      const root = t.category.split(".")[0];
      acc[root] = (acc[root] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [todos]);

  const activeTodoCount = useMemo(() => todos.filter((t) => !isTrashed(t)).length, [todos]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const ok = await addTodo(newTitle.trim(), "medium", newDueDate, newCategory, newAsWaiting ? "waiting" : "active");
    if (ok) {
      showToast("success", "Todo added");
      setNewTitle("");
      setNewDueDate(new Date().toISOString().slice(0, 10));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeTodos.findIndex((t) => t.id === active.id);
    const newIndex = activeTodos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeTodos, oldIndex, newIndex);
    reorderTodos(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
  };

  const handleWaitingDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = waitingTodos.findIndex((t) => t.id === active.id);
    const newIndex = waitingTodos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(waitingTodos, oldIndex, newIndex);
    reorderTodos(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
  };

  const draggedTodo = dragActiveId ? [...activeTodos, ...waitingTodos].find((t) => t.id === dragActiveId) : null;

  // Memoized handlers
  const handleStatusChange = useCallback((id: number, status: 'waiting' | 'active' | 'completed') => { updateStatus(id, status); }, [updateStatus]);
  const handleRestore = useCallback((id: number) => { updateStatus(id, 'active'); }, [updateStatus]);
  const handleMoveToWaiting = useCallback((id: number) => { updateStatus(id, 'waiting'); }, [updateStatus]);
  const handleDelete = useCallback((id: number) => { deleteTodo(id); showToast("success", t("todo.movedToTrash")); }, [deleteTodo, t]);

  const handleRestoreFromTrash = useCallback((id: number) => { restoreTodo(id); showToast("success", t("todo.restored")); }, [restoreTodo, t]);

  const handlePermanentDelete = useCallback((id: number) => {
    if (!window.confirm(t("todo.permanentDeleteConfirm"))) return;
    permanentlyDeleteTodo(id);
    showToast("success", t("todo.permanentlyDeleted"));
  }, [permanentlyDeleteTodo, t]);

  const handleEmptyTrash = useCallback(() => {
    if (!window.confirm(t("todo.emptyTrashConfirm"))) return;
    emptyTrash();
    showToast("success", t("todo.trashEmptied"));
  }, [emptyTrash, t]);
  const handleUpdateDate = useCallback((id: number, d: string) => updateTodo(id, { dueDate: d }), [updateTodo]);
  const handleUpdateTitle = useCallback((id: number, t: string) => updateTodo(id, { title: t }), [updateTodo]);
  const handleUpdateCategory = useCallback((id: number, c: string) => updateTodo(id, { category: c }), [updateTodo]);
  const handleUpdateProgress = useCallback((id: number, p: number) => updateTodo(id, { progress: p }), [updateTodo]);
  const handleUpdatePriority = useCallback((id: number, priority: TodoPriority) => updateTodo(id, { priority }), [updateTodo]);

  // Determine which sections to show based on filter
  const showActiveSection = filter === 'all' || filter === 'active';
  const showWaitingSection = filter === 'all' || filter === 'waiting';
  const showCompletedSection = filter === 'all' || filter === 'completed';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">{t("todo.title")}</h2>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {completionRate}% · {completedCount}/{nonWaitingCount}
            {waitingCount > 0 && <span className="text-amber-500 ml-1">({t("todo.waiting")} {waitingCount})</span>}
          </span>
        </div>
        <div className="h-1 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* Add todo */}
      <form onSubmit={handleAdd} className="px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/40 space-y-2">
        <div className="flex gap-2">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("todo.addPlaceholder")}
            className="input-base flex-1" />
          <button type="button" onClick={() => setNewAsWaiting(!newAsWaiting)}
            title={t("todo.waiting")}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
              newAsWaiting
                ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500 hover:border-amber-300",
            )}>
            <Clock className="w-4 h-4" />
          </button>
          <button type="submit" disabled={!newTitle.trim()}
            className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center disabled:opacity-30 disabled:shadow-none">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <TodoCategoryPicker value={newCategory} onChange={setNewCategory} />
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-slate-400" />
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
              className="text-[11px] bg-slate-100/80 dark:bg-slate-700/50 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none" />
          </div>
        </div>
      </form>

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-100/80 dark:border-slate-700/40">
        <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-700/50 rounded-lg px-2 py-1.5">
          <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("todo.search") ?? "Search todos..."}
            className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Category filter + status filter */}
      <div className="px-4 py-2 border-b border-slate-100/80 dark:border-slate-700/40 space-y-1.5">
        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <button onClick={() => setCategoryFilter("")}
            className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
              !categoryFilter ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50")}>
            {t("todo.all")} ({activeTodoCount})
          </button>
          {TODO_CATEGORIES.filter((c) => categoryCounts[c.id]).map((cat) => (
            <button key={cat.id} onClick={() => setCategoryFilter(categoryFilter === cat.id ? "" : cat.id)}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1",
                categoryFilter === cat.id ? "text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50")}
              style={categoryFilter === cat.id ? { backgroundColor: cat.color } : undefined}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="tabular-nums opacity-70">({categoryCounts[cat.id]})</span>
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex gap-1">
          {(["all", "waiting", "active", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1",
                filter === f ? "bg-slate-200/80 dark:bg-slate-700 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}>
              {f === 'waiting' && <Clock className="w-3 h-3" />}
              {f === "all" ? t("todo.all") : f === "waiting" ? t("todo.waiting") : f === "active" ? t("todo.active") : t("todo.done")}
            </button>
          ))}
        </div>
      </div>

      {/* Todo items */}
      <div className="flex-1 overflow-y-auto min-h-[320px]">
        {/* Active section */}
        {showActiveSection && activeTodos.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={(e) => setDragActiveId(e.active.id as number)}
            onDragEnd={handleDragEnd} onDragCancel={() => setDragActiveId(null)}>
            <SortableContext items={activeTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="py-1">
                {activeTodos.map((todo) => (
                  <SortableTodoItem key={todo.id} todo={todo}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onUpdateDate={handleUpdateDate}
                    onUpdateTitle={handleUpdateTitle}
                    onUpdateCategory={handleUpdateCategory}
                    onUpdateProgress={handleUpdateProgress}
                    onUpdatePriority={handleUpdatePriority} />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {draggedTodo && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200/60 dark:border-slate-600">
                  <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                  <div className={cn("w-1.5 h-1.5 rounded-full", priorityDot(draggedTodo.priority))} />
                  <span className="text-sm text-slate-900 dark:text-white">{draggedTodo.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Waiting section */}
        {showWaitingSection && waitingTodos.length > 0 && (
          <div>
            <button onClick={() => setShowWaiting(!showWaiting)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-amber-500 w-full hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
              {showWaiting ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Clock className="w-3 h-3" />
              {t("todo.waiting")} ({waitingTodos.length})
            </button>
            {showWaiting && (
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={(e) => setDragActiveId(e.active.id as number)}
                onDragEnd={handleWaitingDragEnd} onDragCancel={() => setDragActiveId(null)}>
                <SortableContext items={waitingTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <ul className="py-1">
                    {waitingTodos.map((todo) => (
                      <SortableTodoItem key={todo.id} todo={todo}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onUpdateDate={handleUpdateDate}
                        onUpdateTitle={handleUpdateTitle}
                        onUpdateCategory={handleUpdateCategory}
                        onUpdateProgress={handleUpdateProgress}
                        onUpdatePriority={handleUpdatePriority} />
                    ))}
                  </ul>
                </SortableContext>
                <DragOverlay>
                  {draggedTodo && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-amber-300/60 dark:border-amber-600">
                      <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm text-slate-900 dark:text-white">{draggedTodo.title}</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        )}

        {/* Completed section */}
        {showCompletedSection && completedTodos.length > 0 && (
          <div>
            <button onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-slate-400 w-full hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
              {showCompleted ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {t("todo.done")} ({completedTodos.length})
            </button>
            {showCompleted && (
              <ul>
                {completedTodos.map((todo) => (
                  <CompletedTodoItem
                    key={todo.id}
                    todo={todo}
                    onRestore={handleRestore}
                    onMoveToWaiting={handleMoveToWaiting}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {trashedFiltered.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700/50">
            <button type="button" onClick={() => setShowTrash(!showTrash)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-slate-500 w-full hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
              {showTrash ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Trash2 className="w-3 h-3" />
              {t("todo.trash")} ({trashedFiltered.length})
            </button>
            {showTrash && (
              <>
                <div className="px-4 py-1.5 flex justify-end border-b border-slate-100/80 dark:border-slate-700/40">
                  <button
                    type="button"
                    onClick={handleEmptyTrash}
                    className="text-[10px] font-medium text-red-600 dark:text-red-400 hover:underline px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {t("todo.emptyTrash")}
                  </button>
                </div>
                <ul>
                  {trashedFiltered.map((todo) => (
                    <TrashedTodoItem
                      key={todo.id}
                      todo={todo}
                      onRestore={handleRestoreFromTrash}
                      onPermanentDelete={handlePermanentDelete}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">{t("todo.addFirstTask")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
