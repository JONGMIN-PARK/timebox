import { useEffect, useState, useRef } from "react";
import { useTodoStore, TODO_CATEGORIES, getCategoryInfo, type Todo } from "@/stores/todoStore";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Circle, CheckCircle2, ChevronDown, ChevronRight, GripVertical, CalendarDays, Pencil, Tag } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/lib/useI18n";

// ── Helpers ──
function getDaysLeft(d: string | null): number | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function daysLeftLabel(d: number | null) { if (d === null) return ""; return d === 0 ? "D-Day" : d > 0 ? `D-${d}` : `D+${Math.abs(d)}`; }
function daysLeftColor(d: number | null) { if (d === null) return ""; if (d === 0) return "text-red-500 font-bold"; if (d <= 3) return "text-orange-500"; if (d <= 7) return "text-amber-500"; if (d < 0) return "text-slate-400"; return "text-slate-500"; }
const priorityDot = (p: string) => p === "high" ? "bg-red-500" : p === "medium" ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600";

// ── Category Picker ──
function CategoryPicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const info = getCategoryInfo(value);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className={cn("flex items-center gap-1 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50", compact ? "px-1.5 py-0.5" : "px-2 py-1")}>
        <span className={compact ? "text-xs" : "text-sm"}>{info.icon}</span>
        <span className={cn("text-slate-600 dark:text-slate-400", compact ? "text-[10px]" : "text-xs")}>
          {info.parentLabel ? `${info.parentLabel} › ${info.label}` : info.label}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="absolute z-30 left-0 top-0 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 animate-scale-in max-h-64 overflow-y-auto">
        {TODO_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <button
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
                  <button key={sub.id} onClick={() => { onChange(sub.id); setOpen(false); }}
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
          <button onClick={() => setOpen(false)} className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 text-left">{t("common.close")}</button>
        </div>
      </div>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
    </div>
  );
}

// ── Sortable Todo Item ──
function SortableTodoItem({ todo, onToggle, onDelete, onUpdateDate, onUpdateTitle, onUpdateCategory }: {
  todo: Todo; onToggle: (id: number) => void; onDelete: (id: number) => void;
  onUpdateDate: (id: number, date: string) => void; onUpdateTitle: (id: number, title: string) => void;
  onUpdateCategory: (id: number, cat: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const daysLeft = getDaysLeft(todo.dueDate);
  const catInfo = getCategoryInfo(todo.category);
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== todo.title) onUpdateTitle(todo.id, editTitle.trim());
    else setEditTitle(todo.title);
    setIsEditing(false);
  };

  return (
    <li ref={setNodeRef} style={style}
      className={cn("group flex items-start gap-1.5 px-3 sm:px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors", isDragging && "opacity-40 shadow-lg rounded-xl bg-white dark:bg-slate-800")}>
      <button {...attributes} {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none mt-0.5 p-0.5">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
      </button>
      <button onClick={() => onToggle(todo.id)} className="flex-shrink-0 mt-0.5">
        <Circle className="w-[18px] h-[18px] text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors" />
      </button>
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", priorityDot(todo.priority))} />
          {isEditing ? (
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle} onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setEditTitle(todo.title); setIsEditing(false); } }}
              className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-0.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40" autoFocus />
          ) : (
            <span className="text-[13px] text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onDoubleClick={() => { setIsEditing(true); setEditTitle(todo.title); }}>{todo.title}</span>
          )}
        </div>
        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 ml-3">
          {/* Category tag */}
          <CategoryPicker value={todo.category} onChange={(cat) => onUpdateCategory(todo.id, cat)} compact />
          {/* Date */}
          <button onClick={() => setShowDatePicker(!showDatePicker)}
            className={cn("text-[11px] flex items-center gap-0.5 hover:text-blue-500 transition-colors", daysLeftColor(daysLeft))}>
            <CalendarDays className="w-3 h-3" />
            {todo.dueDate ? <span>{todo.dueDate.slice(5)} <span className="font-medium">{daysLeftLabel(daysLeft)}</span></span>
              : <span className="text-slate-400">Set date</span>}
          </button>
        </div>
        {showDatePicker && (
          <div className="mt-1 ml-3">
            <input type="date" value={todo.dueDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => { onUpdateDate(todo.id, e.target.value); setShowDatePicker(false); }}
              className="text-xs bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40" autoFocus />
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
        {!isEditing && (
          <button onClick={() => { setIsEditing(true); setEditTitle(todo.title); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        <button onClick={() => onDelete(todo.id)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </li>
  );
}

// ── Main TodoList ──
export default function TodoList() {
  const { todos, filter, categoryFilter, loading, setFilter, setCategoryFilter, fetchTodos, addTodo, toggleTodo, deleteTodo, updateTodo, reorderTodos } = useTodoStore();
  const { t } = useI18n();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState("personal");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  // Apply filters
  const filtered = todos.filter((t) => {
    if (categoryFilter && !t.category.startsWith(categoryFilter)) return false;
    return true;
  });
  const activeTodos = filtered.filter((t) => !t.completed).sort((a, b) => a.sortOrder - b.sortOrder);
  const completedTodos = filtered.filter((t) => t.completed);
  const completionRate = filtered.length > 0 ? Math.round((completedTodos.length / filtered.length) * 100) : 0;

  // Category counts for filter
  const categoryCounts = todos.reduce((acc, t) => {
    const root = t.category.split(".")[0];
    acc[root] = (acc[root] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addTodo(newTitle.trim(), "medium", newDueDate, newCategory);
    setNewTitle("");
    setNewDueDate(new Date().toISOString().slice(0, 10));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeTodos.findIndex((t) => t.id === active.id);
    const newIndex = activeTodos.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(activeTodos, oldIndex, newIndex);
    reorderTodos(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
  };

  const draggedTodo = dragActiveId ? activeTodos.find((t) => t.id === dragActiveId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">{t("todo.title")}</h2>
          <span className="text-[11px] text-slate-400 tabular-nums">{completedTodos.length}/{filtered.length}</span>
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
          <button type="submit" disabled={!newTitle.trim()}
            className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center disabled:opacity-30 disabled:shadow-none">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <CategoryPicker value={newCategory} onChange={setNewCategory} />
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-slate-400" />
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
              className="text-[11px] bg-slate-100/80 dark:bg-slate-700/50 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none" />
          </div>
        </div>
      </form>

      {/* Category filter + status filter */}
      <div className="px-4 py-2 border-b border-slate-100/80 dark:border-slate-700/40 space-y-1.5">
        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <button onClick={() => setCategoryFilter("")}
            className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
              !categoryFilter ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50")}>
            {t("todo.all")} ({todos.length})
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
          {(["all", "active", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                filter === f ? "bg-slate-200/80 dark:bg-slate-700 text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}>
              {f === "all" ? t("todo.all") : f === "active" ? t("todo.active") : t("todo.done")}
            </button>
          ))}
        </div>
      </div>

      {/* Todo items */}
      <div className="flex-1 overflow-y-auto">
        {filter !== "completed" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={(e) => setDragActiveId(e.active.id as number)}
            onDragEnd={handleDragEnd} onDragCancel={() => setDragActiveId(null)}>
            <SortableContext items={activeTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="py-1">
                {activeTodos.map((todo) => (
                  <SortableTodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo}
                    onUpdateDate={(id, d) => updateTodo(id, { dueDate: d })}
                    onUpdateTitle={(id, t) => updateTodo(id, { title: t })}
                    onUpdateCategory={(id, c) => updateTodo(id, { category: c })} />
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

        {filter !== "active" && completedTodos.length > 0 && (
          <div>
            <button onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-slate-400 w-full hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
              {showCompleted ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {t("todo.done")} ({completedTodos.length})
            </button>
            {showCompleted && (
              <ul>
                {completedTodos.map((todo) => {
                  const catInfo = getCategoryInfo(todo.category);
                  return (
                    <li key={todo.id} className="group flex items-center gap-2 px-4 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="w-4" />
                      <button onClick={() => toggleTodo(todo.id)} className="flex-shrink-0">
                        <CheckCircle2 className="w-[18px] h-[18px] text-green-500" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-slate-400 line-through truncate block">{todo.title}</span>
                        <span className="text-[10px] text-slate-400">{catInfo.icon} {catInfo.parentLabel ? `${catInfo.parentLabel} › ${catInfo.label}` : catInfo.label}</span>
                      </div>
                      <button onClick={() => deleteTodo(todo.id)} className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </li>
                  );
                })}
              </ul>
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
