import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Plus, GripVertical, CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useProjectTaskStore, type ProjectTask, type TaskStatus } from "@/stores/projectTaskStore";
import { useProjectStore, type ProjectMember } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import TaskDetailModal from "./TaskDetailModal";

// ── Column config ──
const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "#94a3b8" },
  { key: "todo", label: "To Do", color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "review", label: "Review", color: "#8b5cf6" },
  { key: "done", label: "Done", color: "#10b981" },
];

const priorityColor = (p: string) =>
  p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#94a3b8";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Draggable task card ──
const TaskCard = React.memo(function TaskCard({
  task,
  members,
  onClick,
}: {
  task: ProjectTask;
  members: ProjectMember[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const assignee = task.assigneeId
    ? members.find((m) => m.userId === task.assigneeId)
    : null;

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all",
        isDragging && "opacity-40 shadow-lg",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none mt-0.5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder task"
        >
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColor(task.priority) }}
            />
            <span className="text-[13px] text-slate-900 dark:text-white font-medium truncate">
              {task.title}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2">
            {/* Due date */}
            {task.dueDate && (
              <span
                className={cn(
                  "text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
                  isOverdue
                    ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
                )}
              >
                <CalendarDays className="w-2.5 h-2.5" />
                {task.dueDate.slice(5)}
              </span>
            )}

            {/* Tags */}
            {task.tags &&
              task.tags.split(",").filter(Boolean).slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 truncate max-w-[60px]"
                >
                  {tag.trim()}
                </span>
              ))}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Assignee avatar */}
            {assignee && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "#6366f1" }}
                title={assignee.displayName || assignee.username || ""}
              >
                {getInitials(assignee.displayName || assignee.username || "?")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Droppable column ──
function KanbanColumn({
  column,
  tasks,
  members,
  onClickTask,
  onAddTask,
}: {
  column: (typeof COLUMNS)[number];
  tasks: ProjectTask[];
  members: ProjectMember[];
  onClickTask: (task: ProjectTask) => void;
  onAddTask: (status: TaskStatus, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    onAddTask(column.key, newTitle.trim());
    setNewTitle("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[280px] min-w-[280px] bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 transition-colors",
        isOver && "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/5",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
          {column.label}
        </h3>
        <span className="text-[11px] text-slate-400 tabular-nums font-medium bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[100px]">
        {tasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onClick={() => onClickTask(task)}
            />
          ))}
      </div>

      {/* Add task */}
      <div className="px-2 pb-2">
        {adding ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
              }}
              onBlur={handleAdd}
              placeholder="Task title..."
              className="w-full text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            aria-label={`Add task to ${column.label}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main KanbanBoard ──
interface KanbanBoardProps {
  projectId: number;
}

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { tasks, loading, error, fetchTasks, addTask, updateTask, deleteTask, reorderTasks } =
    useProjectTaskStore();
  const { fetchMembers } = useProjectStore();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    fetchTasks(projectId);
    fetchMembers(projectId).then(setMembers);
  }, [projectId, fetchTasks, fetchMembers]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, ProjectTask[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }
    return grouped;
  }, [tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as number;
    const targetStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.status === targetStatus) return;

    // Optimistic update: move task to new status
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: targetStatus } : t,
    );
    useProjectTaskStore.setState({ tasks: updatedTasks });

    // Persist
    updateTask(projectId, taskId, { status: targetStatus });

    // Reorder: put at end of target column
    const targetTasks = updatedTasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const reorderItems = targetTasks.map((t, i) => ({
      id: t.id,
      sortOrder: i,
      status: targetStatus,
    }));
    reorderTasks(projectId, reorderItems);
  }, [tasks, projectId, updateTask, reorderTasks]);

  const currentUserId = useAuthStore(s => s.user?.id);

  const handleAddTask = useCallback(async (status: TaskStatus, title: string) => {
    const maxSort = tasksByStatus[status].reduce(
      (max, t) => Math.max(max, t.sortOrder),
      -1,
    );
    await addTask(projectId, {
      title,
      status,
      priority: "medium",
      sortOrder: maxSort + 1,
      assigneeId: currentUserId || undefined,
    });
  }, [projectId, addTask, tasksByStatus, currentUserId]);

  const handleUpdateTask = useCallback(async (taskId: number, data: Partial<ProjectTask>) => {
    await updateTask(projectId, taskId, data);
  }, [projectId, updateTask]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    await deleteTask(projectId, taskId);
  }, [projectId, deleteTask]);

  const draggedTask = dragActiveId ? tasks.find((t) => t.id === dragActiveId) : null;

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragActiveId(null)}
        >
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus[col.key]}
                members={members}
                onClickTask={setSelectedTask}
                onAddTask={handleAddTask}
              />
            ))}
          </div>

          <DragOverlay>
            {draggedTask && (
              <div className="w-[260px] bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 shadow-xl rotate-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: priorityColor(draggedTask.priority) }}
                  />
                  <span className="text-[13px] text-slate-900 dark:text-white font-medium truncate">
                    {draggedTask.title}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          projectId={projectId}
          task={selectedTask}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
