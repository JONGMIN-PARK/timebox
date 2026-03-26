import { useEffect, useState } from "react";
import { useTodoStore } from "@/stores/todoStore";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Circle, CheckCircle2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TodoItemProps {
  todo: { id: number; title: string; completed: boolean; priority: string; dueDate: string | null };
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

function SortableTodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityDot = (p: string) => {
    switch (p) {
      case "high": return "bg-red-500";
      case "medium": return "bg-amber-500";
      case "low": return "bg-slate-300 dark:bg-slate-600";
      default: return "bg-slate-300";
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
        isDragging && "opacity-50 bg-slate-100 dark:bg-slate-700 z-50",
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
          <span className="text-sm text-slate-900 dark:text-white truncate">{todo.title}</span>
        </div>
        {todo.dueDate && <span className="text-xs text-slate-400 ml-3.5">{todo.dueDate}</span>}
      </div>
      <button onClick={() => onDelete(todo.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
      </button>
    </li>
  );
}

export default function TodoList() {
  const { todos, filter, loading, setFilter, fetchTodos, addTodo, toggleTodo, deleteTodo, reorderTodos } = useTodoStore();
  const [newTitle, setNewTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

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
    await addTodo(newTitle.trim());
    setNewTitle("");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeTodos.findIndex((t) => t.id === active.id);
    const newIndex = activeTodos.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(activeTodos, oldIndex, newIndex);

    reorderTodos(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">투두 리스트</h2>
          <span className="text-xs text-slate-500">{completedTodos.length}/{todos.length}</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* Add todo */}
      <form onSubmit={handleAdd} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="할 일 추가..."
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
      </form>

      {/* Filter tabs */}
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
            {f === "all" ? "전체" : f === "active" ? "진행 중" : "완료"}
          </button>
        ))}
      </div>

      {/* Todo items */}
      <div className="flex-1 overflow-y-auto">
        {/* Active todos - sortable */}
        {filter !== "completed" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="py-2">
                {activeTodos.map((todo) => (
                  <SortableTodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Completed section */}
        {filter !== "active" && completedTodos.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 w-full hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              완료 ({completedTodos.length})
            </button>
            {showCompleted && (
              <ul>
                {completedTodos.map((todo) => (
                  <li key={todo.id} className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="w-4" />
                    <button onClick={() => toggleTodo(todo.id)} className="flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </button>
                    <span className="flex-1 text-sm text-slate-400 line-through truncate">{todo.title}</span>
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
            <p className="text-sm">할 일을 추가하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
