import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Plus, GripVertical, CalendarDays, Loader2, Clock, Pencil, User } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

/** Format datetime as MM-DD HH:mm:ss in KST */
function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/** Stable sort: by sortOrder, then by id as tiebreaker */
function stableSort(tasks: ProjectTask[]) {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};

// ── Draggable task card ──
const TaskCard = React.memo(function TaskCard({
  task,
  members,
  onClick,
  readOnly,
}: {
  task: ProjectTask;
  members: ProjectMember[];
  onClick: () => void;
  readOnly?: boolean;
}) {
  const currentUserId = useAuthStore(s => s.user?.id);
  const isMyTask = task.assigneeId === currentUserId;
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>();
  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, status: task.status },
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
    position: "relative",
    opacity: isDragging ? 0.85 : undefined,
  };

  const assignee = task.assigneeId
    ? members.find((m) => m.userId === task.assigneeId)
    : null;

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  const handleMouseEnter = () => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 400);
  };
  const handleMouseLeave = () => {
    clearTimeout(tooltipTimer.current);
    setShowTooltip(false);
  };
  const handleTouchStart = () => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleTouchEnd = () => {
    clearTimeout(tooltipTimer.current);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={style}
      {...attributes}
      {...(readOnly ? {} : listeners)}
      className={cn(
        "group bg-white dark:bg-slate-800 rounded-lg border p-2.5 touch-none hover:shadow-sm transition-colors",
        readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging
          ? "border-blue-400 dark:border-blue-500 shadow-xl"
          : isMyTask
          ? "border-l-[3px] border-l-blue-500 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-l-blue-400 dark:border-t-slate-700 dark:border-r-slate-700 dark:border-b-slate-700 hover:border-l-blue-600"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
      )}
      onClick={isDragging ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-1">
        {!readOnly && (
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        <div className="flex-1 min-w-0">
          {/* Row 1: Title + Edit button */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColor(task.priority) }}
            />
            <span className="text-[13px] text-slate-900 dark:text-white font-medium truncate flex-1">
              {task.title}
            </span>
            <button
              onClick={handleEditClick}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-opacity flex-shrink-0"
              title="Edit"
            >
              <Pencil className="w-3 h-3 text-slate-400 hover:text-blue-500" />
            </button>
          </div>

          {/* Row 2: Due date + Tags + Reactions */}
          <div className="flex items-center gap-1.5 mt-1.5">
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

            {task.tags &&
              task.tags.split(",").filter(Boolean).slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 truncate max-w-[60px]"
                >
                  {tag.trim()}
                </span>
              ))}

            <div className="flex-1" />

            {task.reactions && Object.keys(task.reactions).length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                {Object.entries(task.reactions).slice(0, 3).map(([emoji, count]) => (
                  <span key={emoji} title={`${emoji} ${count}`}>{emoji}{(count as number) > 1 ? count : ""}</span>
                ))}
              </span>
            )}
          </div>

          {/* Row 3: Updated time + Assignee */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 tabular-nums">
              <Clock className="w-2.5 h-2.5" />
              {fmtDateTime(task.updatedAt)}
            </span>

            <div className="flex-1" />

            {assignee && (
              <span className={cn(
                "text-[10px] font-medium truncate max-w-[80px] flex items-center gap-0.5",
                isMyTask ? "text-blue-600 dark:text-blue-400" : "text-indigo-500 dark:text-indigo-400"
              )}>
                {isMyTask ? "✓" : <User className="w-2.5 h-2.5" />}
                {assignee.displayName || assignee.username || "?"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover tooltip with details */}
      {showTooltip && !isDragging && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-3 space-y-1.5 pointer-events-none"
          style={{ minWidth: 200 }}
        >
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{task.title}</p>
          {task.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
            <span>Priority: <strong className="text-slate-700 dark:text-slate-300">{PRIORITY_LABEL[task.priority] || task.priority}</strong></span>
            {task.dueDate && <span>Due: <strong className="text-slate-700 dark:text-slate-300">{task.dueDate}</strong></span>}
            {task.startDate && <span>Start: <strong className="text-slate-700 dark:text-slate-300">{task.startDate}</strong></span>}
            {assignee && <span>Assignee: <strong className="text-slate-700 dark:text-slate-300">{assignee.displayName || assignee.username}</strong></span>}
            <span>Updated: <strong className="text-slate-700 dark:text-slate-300">{fmtDateTime(task.updatedAt)}</strong></span>
          </div>
        </div>
      )}
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
  isDraggingAny,
  readOnly,
}: {
  column: (typeof COLUMNS)[number];
  tasks: ProjectTask[];
  members: ProjectMember[];
  onClickTask: (task: ProjectTask) => void;
  onAddTask: (status: TaskStatus, title: string) => void;
  isDraggingAny: boolean;
  readOnly?: boolean;
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

  const sorted = stableSort(tasks);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[80vw] sm:w-[240px] md:w-[260px] min-w-[200px] flex-shrink-0 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40 transition-colors",
        isOver && !readOnly && "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/5",
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
      <div className={cn("flex-1 px-2 py-2 space-y-2 min-h-[100px]", isDraggingAny ? "overflow-visible" : "overflow-y-auto")}>
        <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                onClick={() => onClickTask(task)}
                readOnly={readOnly}
              />
            ))}
        </SortableContext>
      </div>

      {/* Add task — hidden for viewers */}
      {!readOnly && (
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
      )}
    </div>
  );
}

// ── Main KanbanBoard ──
interface KanbanBoardProps {
  projectId: number;
  myRole?: string;
}

export default function KanbanBoard({ projectId, myRole }: KanbanBoardProps) {
  const { tasks, loading, error, fetchTasks, addTask, updateTask, deleteTask, reorderTasks } =
    useProjectTaskStore();
  const { fetchMembers } = useProjectStore();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [dragActiveId, setDragActiveId] = useState<number | null>(null);

  const readOnly = myRole === "viewer";

  const notifyTaskChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent("project-tasks-updated", { detail: { projectId } }));
  }, [projectId]);

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

    const activeId = active.id as number;
    const overId = over.id;
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if dropped on a column (status string) or on another task (number)
    const isColumnDrop = typeof overId === "string" && ["backlog", "todo", "in_progress", "review", "done"].includes(overId);

    if (isColumnDrop) {
      const targetStatus = overId as TaskStatus;
      if (activeTask.status === targetStatus) return;

      // Move to new column
      const updatedTasks = tasks.map(t =>
        t.id === activeId ? { ...t, status: targetStatus } : t
      );
      useProjectTaskStore.setState({ tasks: updatedTasks });
      updateTask(projectId, activeId, { status: targetStatus });

      const targetTasks = updatedTasks.filter(t => t.status === targetStatus).sort((a, b) => a.sortOrder - b.sortOrder);
      reorderTasks(projectId, targetTasks.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
    } else {
      // Dropped on another task — reorder within same column OR move to different column
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      const targetStatus = overTask.status;
      const sameColumn = activeTask.status === targetStatus;

      // Get column tasks
      let columnTasks = tasks
        .filter(t => t.status === targetStatus)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (!sameColumn) {
        // Move to new column first
        const movedTask = { ...activeTask, status: targetStatus };
        columnTasks = [...columnTasks.filter(t => t.id !== activeId), movedTask];
      }

      // Reorder: remove active, insert at over position
      const oldIndex = columnTasks.findIndex(t => t.id === activeId);
      const newIndex = columnTasks.findIndex(t => t.id === (overId as number));

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = [...columnTasks];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        // Update sort orders
        const updatedTasks = tasks.map(t => {
          const idx = reordered.findIndex(r => r.id === t.id);
          if (idx !== -1) return { ...t, status: targetStatus, sortOrder: idx };
          if (t.id === activeId && !sameColumn) return { ...t, status: targetStatus };
          return t;
        });

        useProjectTaskStore.setState({ tasks: updatedTasks });
        reorderTasks(projectId, reordered.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
      } else if (!sameColumn) {
        // Just move between columns (dropped on task in different column)
        const updatedTasks = tasks.map(t =>
          t.id === activeId ? { ...t, status: targetStatus } : t
        );
        useProjectTaskStore.setState({ tasks: updatedTasks });
        updateTask(projectId, activeId, { status: targetStatus });

        const targetTasks = updatedTasks.filter(t => t.status === targetStatus).sort((a, b) => a.sortOrder - b.sortOrder);
        reorderTasks(projectId, targetTasks.map((t, i) => ({ id: t.id, sortOrder: i, status: targetStatus })));
      }
    }
    // Notify stats refresh on any status change
    showToast("success", "Task status changed");
    notifyTaskChange();
  }, [tasks, projectId, updateTask, reorderTasks, notifyTaskChange]);

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
    showToast("success", "Task created");
    notifyTaskChange();
  }, [projectId, addTask, tasksByStatus, currentUserId, notifyTaskChange]);

  const handleUpdateTask = useCallback(async (taskId: number, data: Partial<ProjectTask>) => {
    await updateTask(projectId, taskId, data);
    showToast("success", "Task updated");
    notifyTaskChange();
  }, [projectId, updateTask, notifyTaskChange]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    await deleteTask(projectId, taskId);
    showToast("success", "Task deleted");
    notifyTaskChange();
  }, [projectId, deleteTask, notifyTaskChange]);

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
      <div className={cn("flex-1 px-2 sm:px-4 py-2 sm:py-4", dragActiveId ? "overflow-visible" : "overflow-x-auto overflow-y-hidden")}>
        <DndContext
          sensors={readOnly ? [] : sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragActiveId(null)}
        >
          <div className="flex gap-2 sm:gap-3 md:gap-4 h-full min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus[col.key]}
                members={members}
                onClickTask={setSelectedTask}
                onAddTask={handleAddTask}
                isDraggingAny={dragActiveId !== null}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Card moves via useSortable transform — no DragOverlay needed */}
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
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
