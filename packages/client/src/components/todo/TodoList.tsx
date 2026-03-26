import { useEffect, useState, useRef } from "react";
import { useTodoStore } from "@/stores/todoStore";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Circle, CheckCircle2, ChevronDown, ChevronRight, GripVertical, CalendarDays, Pencil } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  sortOrder: number;
}

function getDaysLeft(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLeftLabel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "D-Day";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function daysLeftColor(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "text-red-500 font-bold";
  if (days <= 3) return "text-orange-500";
  if (days <= 7) return "text-amber-500";
  if (days < 0) return "text-slate-400";
  return "text-slate-500";
}

const priorityDot = (p: string) => {
  switch (p) {
    case "high": return "bg-red-500";
    case "medium": return "bg-amber-500";
    case "low": return "bg-slate-300 dark:bg-slate-600";
    default: return "bg-slate-300";
  }
};

interface SortableItemProps {
  todo: TodoItem;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateDate: (id: number, date: string) => void;
  onUpdateTitle: (id: number, title: string) => void;
}

function SortableTodoItem({ todo, onToggle, onDelete, onUpdateDate, onUpdateTitle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const editRef = useRef<HTMLInputElement>(null);
  const daysLeft = getDaysLeft(todo.dueDate);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== todo.title) {
      onUpdateTitle(todo.id, editTitle.trim());
    } else {
      setEditTitle(todo.title);
    }
    setIsEditing(false);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
        isDragging && "opacity-50 bg-slate-100 dark:bg-slate-700 z-50 shadow-lg rounded-lg",
      )}
    >
      <button {...attributes} {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600" />
      </button>
      <button onClick={() => onToggle(todo.id)} className="flex-shrink-0">
        <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", priorityDot(todo.priority))} />
          {isEditing ? (
            <input
              ref={editRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setEditTitle(todo.title); setIsEditing(false); } }}
              className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <span
              className="text-sm text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onDoubleClick={() => { setIsEditing(true); setEditTitle(todo.title); }}
            >
              {todo.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3.5 mt-0.5">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={cn("text-xs flex items-center gap-1 hover:text-blue-500 transition-colors", daysLeftColor(daysLeft))}
          >
            <CalendarDays className="w-3 h-3" />
            {todo.dueDate ? (
              <span>{todo.dueDate} <span className="font-medium">{daysLeftLabel(daysLeft)}</span></span>
            ) : (
              <span className="text-slate-400">Set date</span>
            )}
          </button>
        </div>
        {showDatePicker && (
          <div className="mt-1 ml-3.5">
            <input
              type="date"
              value={todo.dueDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => { onUpdateDate(todo.id, e.target.value); setShowDatePicker(false); }}
              className="text-xs bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setEditTitle(todo.title); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
          </button>
        )}
        <button onClick={() => onDelete(todo.id)} className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center">
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
        </button>
      </div>
    </li>
  );
}

export default function TodoList() {
  const { todos, filter, loading, setFilter, fetchTodos, addTodo, toggleTodo, deleteTodo, updateTodo, reorderTodos } = useTodoStore();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [showCompleted, setShowCompleted] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const activeTodos = todos.filter((t) => !t.completed).sort((a, b) => a.sortOrder - b.sortOrder);
  const completedTodos = todos.filter((t) => t.completed);
  const completionRate = todos.length > 0 ? Math.round((completedTodos.length / todos.length) * 100) : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addTodo(newTitle.trim(), "medium", newDueDate);
    setNewTitle("");
    setNewDueDate(new Date().toISOString().slice(0, 10));
  };

  const handleUpdateDate = (id: number, date: string) => {
    updateTodo(id, { dueDate: date });
  };

  const handleUpdateTitle = (id: number, title: string) => {
    updateTodo(id, { title });
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
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Todo List</h2>
          <span className="text-xs text-slate-500">{completedTodos.length}/{todos.length}</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      <form onSubmit={handleAdd} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-600 flex items-center justify-center text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 outline-none"
          />
          <span className="text-xs text-slate-400">Due date</span>
        </div>
      </form>

      <div className="flex gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              filter === f
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700",
            )}
          >
            {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filter !== "completed" && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setDragActiveId(e.active.id as number)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragActiveId(null)}
          >
            <SortableContext items={activeTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="py-2">
                {activeTodos.map((todo) => (
                  <SortableTodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={toggleTodo}
                    onDelete={deleteTodo}
                    onUpdateDate={handleUpdateDate}
                    onUpdateTitle={handleUpdateTitle}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {draggedTodo && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-200 dark:border-slate-600">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  <div className={cn("w-1.5 h-1.5 rounded-full", priorityDot(draggedTodo.priority))} />
                  <span className="text-sm text-slate-900 dark:text-white">{draggedTodo.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {filter !== "active" && completedTodos.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 w-full hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Done ({completedTodos.length})
            </button>
            {showCompleted && (
              <ul>
                {completedTodos.map((todo) => (
                  <li key={todo.id} className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="w-4" />
                    <button onClick={() => toggleTodo(todo.id)} className="flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-400 line-through truncate block">{todo.title}</span>
                      {todo.dueDate && <span className="text-xs text-slate-400">{todo.dueDate}</span>}
                    </div>
                    <button onClick={() => deleteTodo(todo.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {todos.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">Add your first task</p>
          </div>
        )}
      </div>
    </div>
  );
}
